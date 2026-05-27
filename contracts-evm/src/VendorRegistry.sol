// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title VendorRegistry
/// @notice EVM port of the Soroban `vendor-registry`. Apply -> approve flow, admin
///         direct-register, profile updates, on-chain ratings, and default tracking.
///         `admin.require_auth()` becomes the `ADMIN_ROLE` modifier; self-auth calls
///         (apply / update / rate) key off `msg.sender`.
contract VendorRegistry is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    enum ApplicationStatus {
        None, // default for never-applied wallets (id 0 slot)
        Pending,
        Approved,
        Rejected
    }

    struct VendorApplication {
        address wallet;
        string marketId;
        string name;
        string stallNumber;
        string phone;
        string productType;
        uint64 appliedAt;
        ApplicationStatus status;
    }

    struct VendorRecord {
        uint64 id;
        address wallet;
        string marketId;
        string name;
        string stallNumber;
        string phone;
        string productType;
        uint64 registeredAt;
        uint64 totalTransactions;
        uint256 totalVolume;
        bool isActive;
    }

    struct Rating {
        address customer;
        uint32 stars;
        bytes32 commentHash; // SHA-256 of off-chain comment; bytes32(0) when none
        uint64 createdAt;
    }

    uint64 public vendorCount;

    mapping(address => VendorRecord) private vendors;
    mapping(address => VendorApplication) private applications;
    address[] private pendingList;
    address[] private vendorList;

    mapping(address => mapping(bytes32 => Rating)) private ratings;
    mapping(address => mapping(bytes32 => bool)) private rated;
    mapping(address => uint32) private ratingSumOf;
    mapping(address => uint32) private ratingCountOf;

    mapping(address => uint32) private vendorDefaultsReceivedOf;
    mapping(address => uint32) private customerDefaultsHistoryOf;

    event VendorRegistered(uint64 indexed vendorId, address indexed wallet, string marketId);
    event RatingSubmitted(
        address indexed vendor, address indexed customer, uint32 stars, bytes32 txHash
    );
    event DefaultReported(
        address indexed vendor, address indexed customer, uint32 vendorTotal, uint32 customerTotal
    );

    error AlreadyRegistered();
    error ApplicationAlreadyPending();
    error ApplicationNotFound();
    error ApplicationNotPending();
    error VendorNotFound();
    error AmountMustBePositive();
    error StarsOutOfRange();
    error AlreadyRated();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    // ── Vendor self-applies (no admin) ──────────────────────────────────────────

    function applyVendor(
        string calldata marketId,
        string calldata name,
        string calldata stallNumber,
        string calldata phone,
        string calldata productType
    ) external {
        if (vendors[msg.sender].id != 0) revert AlreadyRegistered();
        if (applications[msg.sender].status == ApplicationStatus.Pending) {
            revert ApplicationAlreadyPending();
        }

        applications[msg.sender] = VendorApplication({
            wallet: msg.sender,
            marketId: marketId,
            name: name,
            stallNumber: stallNumber,
            phone: phone,
            productType: productType,
            appliedAt: uint64(block.timestamp),
            status: ApplicationStatus.Pending
        });
        pendingList.push(msg.sender);
    }

    // ── Admin approves / rejects ─────────────────────────────────────────────────

    function approveVendor(address wallet) external onlyRole(ADMIN_ROLE) {
        VendorApplication storage app = applications[wallet];
        if (app.status == ApplicationStatus.None) revert ApplicationNotFound();
        if (app.status != ApplicationStatus.Pending) revert ApplicationNotPending();

        app.status = ApplicationStatus.Approved;

        uint64 id = ++vendorCount;
        vendors[wallet] = VendorRecord({
            id: id,
            wallet: wallet,
            marketId: app.marketId,
            name: app.name,
            stallNumber: app.stallNumber,
            phone: app.phone,
            productType: app.productType,
            registeredAt: uint64(block.timestamp),
            totalTransactions: 0,
            totalVolume: 0,
            isActive: true
        });
        vendorList.push(wallet);
        _removeFromPending(wallet);

        emit VendorRegistered(id, wallet, app.marketId);
    }

    function rejectVendor(address wallet) external onlyRole(ADMIN_ROLE) {
        VendorApplication storage app = applications[wallet];
        if (app.status == ApplicationStatus.None) revert ApplicationNotFound();
        if (app.status != ApplicationStatus.Pending) revert ApplicationNotPending();

        app.status = ApplicationStatus.Rejected;
        _removeFromPending(wallet);
    }

    // ── Admin direct-register (bypass apply flow) ────────────────────────────────

    function registerVendor(
        address wallet,
        string calldata marketId,
        string calldata name,
        string calldata stallNumber,
        string calldata phone,
        string calldata productType
    ) external onlyRole(ADMIN_ROLE) returns (uint64 id) {
        if (vendors[wallet].id != 0) revert AlreadyRegistered();

        id = ++vendorCount;
        vendors[wallet] = VendorRecord({
            id: id,
            wallet: wallet,
            marketId: marketId,
            name: name,
            stallNumber: stallNumber,
            phone: phone,
            productType: productType,
            registeredAt: uint64(block.timestamp),
            totalTransactions: 0,
            totalVolume: 0,
            isActive: true
        });
        vendorList.push(wallet);

        emit VendorRegistered(id, wallet, marketId);
    }

    function updateProfile(
        string calldata name,
        string calldata stallNumber,
        string calldata phone,
        string calldata productType
    ) external {
        VendorRecord storage record = vendors[msg.sender];
        if (record.id == 0) revert VendorNotFound();
        record.name = name;
        record.stallNumber = stallNumber;
        record.phone = phone;
        record.productType = productType;
    }

    function deactivateVendor(address wallet) external onlyRole(ADMIN_ROLE) {
        VendorRecord storage record = vendors[wallet];
        if (record.id == 0) revert VendorNotFound();
        record.isActive = false;
    }

    /// @notice Mirrors Soroban `increment_stats`: silently no-ops if vendor is unknown.
    function incrementStats(address vendor, uint256 amount) external onlyRole(ADMIN_ROLE) {
        if (amount == 0) revert AmountMustBePositive();
        VendorRecord storage record = vendors[vendor];
        if (record.id == 0) return;
        record.totalTransactions += 1;
        record.totalVolume += amount;
    }

    // ── Ratings ──────────────────────────────────────────────────────────────────

    function submitRating(address vendor, bytes32 txHash, uint32 stars, bytes32 commentHash)
        external
    {
        if (stars < 1 || stars > 5) revert StarsOutOfRange();
        if (vendors[vendor].id == 0) revert VendorNotFound();
        if (rated[vendor][txHash]) revert AlreadyRated();

        ratings[vendor][txHash] = Rating({
            customer: msg.sender,
            stars: stars,
            commentHash: commentHash,
            createdAt: uint64(block.timestamp)
        });
        rated[vendor][txHash] = true;
        ratingSumOf[vendor] += stars;
        ratingCountOf[vendor] += 1;

        emit RatingSubmitted(vendor, msg.sender, stars, txHash);
    }

    // ── Default tracking (aggregate mirror; utang-escrow is source of truth) ─────

    function reportDefault(address vendor, address customer) external onlyRole(ADMIN_ROLE) {
        uint32 vendorTotal = ++vendorDefaultsReceivedOf[vendor];
        uint32 customerTotal = ++customerDefaultsHistoryOf[customer];
        emit DefaultReported(vendor, customer, vendorTotal, customerTotal);
    }

    // ── Queries ──────────────────────────────────────────────────────────────────

    function getVendor(address wallet) external view returns (VendorRecord memory) {
        VendorRecord memory r = vendors[wallet];
        if (r.id == 0) revert VendorNotFound();
        return r;
    }

    function getApplication(address wallet) external view returns (VendorApplication memory) {
        VendorApplication memory a = applications[wallet];
        if (a.status == ApplicationStatus.None) revert ApplicationNotFound();
        return a;
    }

    function getPendingVendors(uint256 limit, uint256 offset)
        external
        view
        returns (VendorApplication[] memory)
    {
        uint256 len = pendingList.length;
        if (offset >= len || limit == 0) {
            return new VendorApplication[](0);
        }
        uint256 end = offset + limit;
        if (end > len) {
            end = len;
        }
        VendorApplication[] memory out = new VendorApplication[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            out[i - offset] = applications[pendingList[i]];
        }
        return out;
    }

    function getAllVendors(uint256 limit, uint256 offset)
        external
        view
        returns (VendorRecord[] memory)
    {
        uint256 len = vendorList.length;
        if (offset >= len || limit == 0) {
            return new VendorRecord[](0);
        }
        uint256 end = offset + limit;
        if (end > len) {
            end = len;
        }
        VendorRecord[] memory out = new VendorRecord[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            out[i - offset] = vendors[vendorList[i]];
        }
        return out;
    }

    function pendingCount() external view returns (uint256) {
        return pendingList.length;
    }

    /// @notice (sum, count) of stars for a vendor. Average = sum / count, computed client-side.
    function getVendorRating(address vendor) external view returns (uint32 sum, uint32 count) {
        return (ratingSumOf[vendor], ratingCountOf[vendor]);
    }

    function getRating(address vendor, bytes32 txHash) external view returns (Rating memory) {
        return ratings[vendor][txHash];
    }

    function hasRated(address vendor, bytes32 txHash) external view returns (bool) {
        return rated[vendor][txHash];
    }

    function vendorDefaultsReceived(address vendor) external view returns (uint32) {
        return vendorDefaultsReceivedOf[vendor];
    }

    function customerDefaultsHistory(address customer) external view returns (uint32) {
        return customerDefaultsHistoryOf[customer];
    }

    // ── Internal ──────────────────────────────────────────────────────────────────

    /// @dev Swap-and-pop removal. Pending order is cosmetic, so O(1) tail removal is fine.
    function _removeFromPending(address wallet) private {
        uint256 len = pendingList.length;
        for (uint256 i = 0; i < len; i++) {
            if (pendingList[i] == wallet) {
                pendingList[i] = pendingList[len - 1];
                pendingList.pop();
                return;
            }
        }
    }
}
