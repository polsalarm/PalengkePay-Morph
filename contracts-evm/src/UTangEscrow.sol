// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title UTangEscrow
/// @notice EVM port of the Soroban `utang-escrow` BNPL contract, native-ETH edition.
///         Vendor and customer agree an installment plan; the customer pays each
///         installment, a 1% reserve is skimmed into contract custody, and the reserve
///         is refunded on clean completion or paid to the vendor on default.
///
///         Native-ETH money flow (replaces SAC `token.transfer`):
///           - payInstallment is payable: msg.value MUST equal payAmount + reserveFee.
///             payAmount is forwarded to the vendor; reserveFee stays in the contract.
///           - on completion the accumulated reserve is refunded to the customer.
///           - on default the accumulated reserve is paid to the vendor.
///           - resumeAfterLate is payable: msg.value MUST equal the late fee (to vendor).
///
///         `set_token` is dropped (no SAC address; settlement is ETH). Reentrancy is an
///         EVM-specific risk that did not exist on Soroban — every external-call path is
///         `nonReentrant` and follows checks-effects-interactions.
contract UTangEscrow is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    uint256 private constant RESERVE_BPS = 100; // 1% of each installment -> reserve
    uint256 private constant LATE_FEE_BPS = 500; // 5% of installment -> vendor on resume
    uint64 private constant DEFAULT_GRACE_SECONDS = 604_800; // 7 days past next_due

    enum UtangStatus {
        None,
        Active,
        Completed,
        Defaulted
    }

    struct Utang {
        uint64 id;
        address customer;
        address vendor;
        uint256 totalAmount;
        uint256 installmentAmount;
        uint32 installmentsTotal;
        uint32 installmentsPaid;
        uint64 nextDue;
        uint64 intervalSeconds;
        UtangStatus status;
        string description;
    }

    uint64 public utangCount;
    uint64 public activeUtangCount;
    uint64 public gracePeriod = DEFAULT_GRACE_SECONDS;
    uint256 public maxUtangAmount = type(uint256).max;

    mapping(uint64 => Utang) private utangs;
    mapping(uint64 => uint256) private reserveOf;
    mapping(address => uint64[]) private customerUtangs;
    mapping(address => uint64[]) private vendorUtangs;
    mapping(address => uint32) private customerDefaultsOf;
    mapping(address => uint32) private vendorDefaultsOf;

    event UtangCreated(
        uint64 indexed utangId,
        address indexed customer,
        address indexed vendor,
        uint256 totalAmount,
        uint32 installmentsTotal
    );
    event InstallmentPaid(
        uint64 indexed utangId, uint32 installmentNumber, uint256 amount, uint32 remaining
    );
    event UtangCompleted(uint64 indexed utangId, address indexed customer, address indexed vendor);
    event UtangDefaulted(
        uint64 indexed utangId,
        address indexed customer,
        address indexed vendor,
        uint256 reservePaidOut
    );
    event UtangResumed(
        uint64 indexed utangId, address indexed customer, address indexed vendor, uint256 lateFee
    );

    error TotalAmountMustBePositive();
    error InstallmentsMustBeAtLeastOne();
    error DegenerateInstallmentPlan();
    error IntervalMustBePositive();
    error ExceedsMaxUtangAmount();
    error UtangNotFound();
    error NotTheDebtor();
    error UtangNotActive();
    error UtangNotDefaulted();
    error AlreadyFullyPaid();
    error GracePeriodNotElapsed();
    error WrongPaymentAmount(uint256 expected, uint256 sent);
    error MaxMustBePositive();
    error TransferFailed();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    // ── Admin knobs ────────────────────────────────────────────────────────────

    function setGracePeriod(uint64 secondsValue) external onlyRole(ADMIN_ROLE) {
        gracePeriod = secondsValue;
    }

    function setMaxUtangAmount(uint256 newMax) external onlyRole(ADMIN_ROLE) {
        if (newMax == 0) revert MaxMustBePositive();
        maxUtangAmount = newMax;
    }

    // ── Create ───────────────────────────────────────────────────────────────────

    /// @notice Customer (msg.sender) opens a BNPL plan with `vendor`. No funds collected
    ///         here — each installment is paid via payInstallment().
    function createUtang(
        address vendor,
        uint256 totalAmount,
        uint32 installmentsTotal,
        uint64 intervalSeconds,
        string calldata description
    ) external returns (uint64 id) {
        if (totalAmount == 0) revert TotalAmountMustBePositive();
        if (installmentsTotal == 0) revert InstallmentsMustBeAtLeastOne();
        if (intervalSeconds == 0) revert IntervalMustBePositive();
        if (totalAmount > maxUtangAmount) revert ExceedsMaxUtangAmount();

        // installmentAmount = ceil(totalAmount / installmentsTotal)
        uint256 installmentAmount = (totalAmount + installmentsTotal - 1) / installmentsTotal;

        // Reject degenerate plans: when ceil rounding makes the first (n-1) installments
        // sum to >= totalAmount, the final installment underflows (vendor over-collects,
        // plan can never complete). Guard at creation keeps funds safe.
        if (installmentAmount * (installmentsTotal - 1) >= totalAmount) {
            revert DegenerateInstallmentPlan();
        }

        id = ++utangCount;
        utangs[id] = Utang({
            id: id,
            customer: msg.sender,
            vendor: vendor,
            totalAmount: totalAmount,
            installmentAmount: installmentAmount,
            installmentsTotal: installmentsTotal,
            installmentsPaid: 0,
            nextDue: uint64(block.timestamp) + intervalSeconds,
            intervalSeconds: intervalSeconds,
            status: UtangStatus.Active,
            description: description
        });
        activeUtangCount += 1;

        customerUtangs[msg.sender].push(id);
        vendorUtangs[vendor].push(id);

        emit UtangCreated(id, msg.sender, vendor, totalAmount, installmentsTotal);
    }

    // ── Pay installment ──────────────────────────────────────────────────────────

    /// @notice Pay the next installment. msg.value MUST equal payAmount + reserveFee, where
    ///         payAmount is the installment (or the exact remainder on the final one).
    function payInstallment(uint64 utangId) external payable nonReentrant {
        Utang storage u = utangs[utangId];
        if (u.status == UtangStatus.None) revert UtangNotFound();
        if (u.customer != msg.sender) revert NotTheDebtor();
        if (u.status != UtangStatus.Active) revert UtangNotActive();
        if (u.installmentsPaid >= u.installmentsTotal) revert AlreadyFullyPaid();

        uint32 remainingInstallments = u.installmentsTotal - u.installmentsPaid;
        uint256 remainingAmount = u.totalAmount - (u.installmentAmount * u.installmentsPaid);
        uint256 payAmount = remainingInstallments == 1 ? remainingAmount : u.installmentAmount;
        uint256 reserveFee = (payAmount * RESERVE_BPS) / 10_000;

        if (msg.value != payAmount + reserveFee) {
            revert WrongPaymentAmount(payAmount + reserveFee, msg.value);
        }

        // ── Effects ──
        u.installmentsPaid += 1;
        uint32 installmentNumber = u.installmentsPaid;
        reserveOf[utangId] += reserveFee; // reserveFee retained in contract balance

        uint256 reserveRefund = 0;
        bool completed = u.installmentsPaid >= u.installmentsTotal;
        if (completed) {
            u.status = UtangStatus.Completed;
            reserveRefund = reserveOf[utangId];
            reserveOf[utangId] = 0;
            if (activeUtangCount > 0) {
                activeUtangCount -= 1;
            }
        } else {
            u.nextDue += u.intervalSeconds;
        }

        emit InstallmentPaid(
            utangId, installmentNumber, payAmount, u.installmentsTotal - u.installmentsPaid
        );
        if (completed) {
            emit UtangCompleted(utangId, u.customer, u.vendor);
        }

        // ── Interactions ──
        _send(u.vendor, payAmount);
        if (reserveRefund > 0) {
            _send(u.customer, reserveRefund);
        }
    }

    // ── Default / resume ───────────────────────────────────────────────────────────

    function isOverdue(uint64 utangId) external view returns (bool) {
        Utang storage u = utangs[utangId];
        if (u.status != UtangStatus.Active) {
            return false;
        }
        return block.timestamp > uint256(u.nextDue) + gracePeriod;
    }

    /// @notice Admin marks an overdue utang defaulted. Reserve is paid to the vendor as
    ///         partial compensation; default counters bump.
    function markDefault(uint64 utangId) external onlyRole(ADMIN_ROLE) nonReentrant {
        Utang storage u = utangs[utangId];
        if (u.status == UtangStatus.None) revert UtangNotFound();
        if (u.status != UtangStatus.Active) revert UtangNotActive();
        if (block.timestamp <= uint256(u.nextDue) + gracePeriod) revert GracePeriodNotElapsed();

        uint256 reserve = reserveOf[utangId];
        reserveOf[utangId] = 0;

        customerDefaultsOf[u.customer] += 1;
        vendorDefaultsOf[u.vendor] += 1;
        u.status = UtangStatus.Defaulted;
        if (activeUtangCount > 0) {
            activeUtangCount -= 1;
        }

        emit UtangDefaulted(utangId, u.customer, u.vendor, reserve);

        if (reserve > 0) {
            _send(u.vendor, reserve);
        }
    }

    /// @notice Customer pays a 5%-of-installment late fee (to vendor) to reactivate a
    ///         defaulted utang. next_due resets to now + interval.
    function resumeAfterLate(uint64 utangId) external payable nonReentrant {
        Utang storage u = utangs[utangId];
        if (u.status == UtangStatus.None) revert UtangNotFound();
        if (u.customer != msg.sender) revert NotTheDebtor();
        if (u.status != UtangStatus.Defaulted) revert UtangNotDefaulted();

        uint256 lateFee = (u.installmentAmount * LATE_FEE_BPS) / 10_000;
        if (msg.value != lateFee) revert WrongPaymentAmount(lateFee, msg.value);

        u.status = UtangStatus.Active;
        u.nextDue = uint64(block.timestamp) + u.intervalSeconds;
        activeUtangCount += 1;

        emit UtangResumed(utangId, u.customer, u.vendor, lateFee);

        if (lateFee > 0) {
            _send(u.vendor, lateFee);
        }
    }

    // ── Queries ──────────────────────────────────────────────────────────────────

    function getUtang(uint64 utangId) external view returns (Utang memory) {
        Utang memory u = utangs[utangId];
        if (u.status == UtangStatus.None) revert UtangNotFound();
        return u;
    }

    function utangReserve(uint64 utangId) external view returns (uint256) {
        return reserveOf[utangId];
    }

    function customerDefaults(address customer) external view returns (uint32) {
        return customerDefaultsOf[customer];
    }

    function vendorDefaults(address vendor) external view returns (uint32) {
        return vendorDefaultsOf[vendor];
    }

    function getCustomerUtangs(address customer, uint256 limit, uint256 offset)
        external
        view
        returns (Utang[] memory)
    {
        return _page(customerUtangs[customer], limit, offset);
    }

    function getVendorUtangs(address vendor, uint256 limit, uint256 offset)
        external
        view
        returns (Utang[] memory)
    {
        return _page(vendorUtangs[vendor], limit, offset);
    }

    function _page(uint64[] storage ids, uint256 limit, uint256 offset)
        private
        view
        returns (Utang[] memory)
    {
        uint256 len = ids.length;
        if (offset >= len || limit == 0) {
            return new Utang[](0);
        }
        uint256 end = offset + limit;
        if (end > len) {
            end = len;
        }
        Utang[] memory out = new Utang[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            out[i - offset] = utangs[ids[i]];
        }
        return out;
    }

    function _send(address to, uint256 amount) private {
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
