// Auto-generated from contracts-evm/out — do not edit by hand.
// Regenerate after `forge build` if the contract ABI changes.
export const vendorRegistryAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "admin",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "ADMIN_ROLE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "DEFAULT_ADMIN_ROLE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "applyVendor",
    "inputs": [
      {
        "name": "marketId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "name",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "stallNumber",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "phone",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "productType",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "approveVendor",
    "inputs": [
      {
        "name": "wallet",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "customerDefaultsHistory",
    "inputs": [
      {
        "name": "customer",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "deactivateVendor",
    "inputs": [
      {
        "name": "wallet",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getAllVendors",
    "inputs": [
      {
        "name": "limit",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "offset",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple[]",
        "internalType": "struct VendorRegistry.VendorRecord[]",
        "components": [
          {
            "name": "id",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "wallet",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "marketId",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "name",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "stallNumber",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "phone",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "productType",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "registeredAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "totalTransactions",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "totalVolume",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "isActive",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getApplication",
    "inputs": [
      {
        "name": "wallet",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct VendorRegistry.VendorApplication",
        "components": [
          {
            "name": "wallet",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "marketId",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "name",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "stallNumber",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "phone",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "productType",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "appliedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "status",
            "type": "uint8",
            "internalType": "enum VendorRegistry.ApplicationStatus"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPendingVendors",
    "inputs": [
      {
        "name": "limit",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "offset",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple[]",
        "internalType": "struct VendorRegistry.VendorApplication[]",
        "components": [
          {
            "name": "wallet",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "marketId",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "name",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "stallNumber",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "phone",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "productType",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "appliedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "status",
            "type": "uint8",
            "internalType": "enum VendorRegistry.ApplicationStatus"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRating",
    "inputs": [
      {
        "name": "vendor",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "txHash",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct VendorRegistry.Rating",
        "components": [
          {
            "name": "customer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "stars",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "commentHash",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "createdAt",
            "type": "uint64",
            "internalType": "uint64"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRoleAdmin",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getVendor",
    "inputs": [
      {
        "name": "wallet",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct VendorRegistry.VendorRecord",
        "components": [
          {
            "name": "id",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "wallet",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "marketId",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "name",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "stallNumber",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "phone",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "productType",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "registeredAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "totalTransactions",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "totalVolume",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "isActive",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getVendorRating",
    "inputs": [
      {
        "name": "vendor",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "sum",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "count",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "grantRole",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "hasRated",
    "inputs": [
      {
        "name": "vendor",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "txHash",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hasRole",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "incrementStats",
    "inputs": [
      {
        "name": "vendor",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "pendingCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "registerVendor",
    "inputs": [
      {
        "name": "wallet",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "marketId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "name",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "stallNumber",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "phone",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "productType",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [
      {
        "name": "id",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "rejectVendor",
    "inputs": [
      {
        "name": "wallet",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "renounceRole",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "callerConfirmation",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "reportDefault",
    "inputs": [
      {
        "name": "vendor",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "customer",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "revokeRole",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "submitRating",
    "inputs": [
      {
        "name": "vendor",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "txHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "stars",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "commentHash",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "supportsInterface",
    "inputs": [
      {
        "name": "interfaceId",
        "type": "bytes4",
        "internalType": "bytes4"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "updateProfile",
    "inputs": [
      {
        "name": "name",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "stallNumber",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "phone",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "productType",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "vendorCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "vendorDefaultsReceived",
    "inputs": [
      {
        "name": "vendor",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "DefaultReported",
    "inputs": [
      {
        "name": "vendor",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "customer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "vendorTotal",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "customerTotal",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RatingSubmitted",
    "inputs": [
      {
        "name": "vendor",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "customer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "stars",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "txHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RoleAdminChanged",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "previousAdminRole",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "newAdminRole",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RoleGranted",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "account",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "sender",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RoleRevoked",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "account",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "sender",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "VendorRegistered",
    "inputs": [
      {
        "name": "vendorId",
        "type": "uint64",
        "indexed": true,
        "internalType": "uint64"
      },
      {
        "name": "wallet",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "marketId",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AccessControlBadConfirmation",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AccessControlUnauthorizedAccount",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "neededRole",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "AlreadyRated",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AlreadyRegistered",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AmountMustBePositive",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ApplicationAlreadyPending",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ApplicationNotFound",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ApplicationNotPending",
    "inputs": []
  },
  {
    "type": "error",
    "name": "StarsOutOfRange",
    "inputs": []
  },
  {
    "type": "error",
    "name": "VendorNotFound",
    "inputs": []
  }
] as const;
