//// ABI TO APPROVE
export const APPROVE_ERC_20_ABI = [
  // Optional: name()
  {
    constant: true,
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    type: "function",
    stateMutability: "view",
  },
  // Optional: symbol()
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    type: "function",
    stateMutability: "view",
  },
  // Optional: decimals()
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
    stateMutability: "view",
  },
  // Optional: totalSupply()
  {
    constant: true,
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    type: "function",
    stateMutability: "view",
  },
  // balanceOf(address)
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
    stateMutability: "view",
  },
  // transfer(address,uint256)
  {
    constant: false,
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "success", type: "bool" }],
    type: "function",
    stateMutability: "nonpayable",
  },
  // transferFrom(address,address,uint256)
  {
    constant: false,
    inputs: [
      { name: "_from", type: "address" },
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "transferFrom",
    outputs: [{ name: "success", type: "bool" }],
    type: "function",
    stateMutability: "nonpayable",
  },
  // approve(address,uint256)
  {
    constant: false,
    inputs: [
      { name: "_spender", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "success", type: "bool" }],
    type: "function",
    stateMutability: "nonpayable",
  },
  // allowance(address,address)
  {
    constant: true,
    inputs: [
      { name: "_owner", type: "address" },
      { name: "_spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "remaining", type: "uint256" }],
    type: "function",
    stateMutability: "view",
  },
];
// /////////////////// DECENT LOCKER //////////////////////

export const decentLockABI = [
    {
      type: "constructor",
      stateMutability: "nonpayable",
      inputs: [
        { type: "address", name: "_feeRecipient", internalType: "address" },
      ],
    },
    {
      type: "event",
      name: "FeePaid",
      inputs: [
        { type: "address", name: "user", internalType: "address", indexed: true },
        {
          type: "address",
          name: "tokenAddress",
          internalType: "address",
          indexed: false,
        },
        {
          type: "uint256",
          name: "feeAmount",
          internalType: "uint256",
          indexed: false,
        },
      ],
      anonymous: false,
    },
    {
      type: "event",
      name: "TokensLocked",
      inputs: [
        { type: "address", name: "user", internalType: "address", indexed: true },
        {
          type: "address",
          name: "tokenAddress",
          internalType: "address",
          indexed: false,
        },
        {
          type: "uint256",
          name: "amount",
          internalType: "uint256",
          indexed: false,
        },
        {
          type: "uint256",
          name: "unlockTime",
          internalType: "uint256",
          indexed: false,
        },
      ],
      anonymous: false,
    },
    {
      type: "event",
      name: "TokensWithdrawn",
      inputs: [
        { type: "address", name: "user", internalType: "address", indexed: true },
        {
          type: "address",
          name: "tokenAddress",
          internalType: "address",
          indexed: false,
        },
        {
          type: "uint256",
          name: "amount",
          internalType: "uint256",
          indexed: false,
        },
      ],
      anonymous: false,
    },
    {
      type: "function",
      stateMutability: "view",
      outputs: [{ type: "uint256", name: "", internalType: "uint256" }],
      name: "feePercentage",
      inputs: [],
    },
    {
      type: "function",
      stateMutability: "view",
      outputs: [{ type: "address", name: "", internalType: "address" }],
      name: "feeRecipient",
      inputs: [],
    },
    {
      type: "function",
      stateMutability: "view",
      outputs: [{ type: "uint256", name: "", internalType: "uint256" }],
      name: "getLockCount",
      inputs: [{ type: "address", name: "user", internalType: "address" }],
    },
    {
      type: "function",
      stateMutability: "view",
      outputs: [
        { type: "address", name: "tokenAddress", internalType: "address" },
        { type: "uint256", name: "amount", internalType: "uint256" },
        { type: "uint256", name: "unlockTime", internalType: "uint256" },
      ],
      name: "getLockInfo",
      inputs: [
        { type: "address", name: "user", internalType: "address" },
        { type: "uint256", name: "index", internalType: "uint256" },
      ],
    },
    {
      type: "function",
      stateMutability: "nonpayable",
      outputs: [],
      name: "lockTokens",
      inputs: [
        { type: "address", name: "tokenAddress", internalType: "address" },
        { type: "uint256", name: "amount", internalType: "uint256" },
        { type: "uint256", name: "timeInSeconds", internalType: "uint256" },
      ],
    },
    {
      type: "function",
      stateMutability: "view",
      outputs: [
        { type: "address", name: "tokenAddress", internalType: "address" },
        { type: "uint256", name: "amount", internalType: "uint256" },
        { type: "uint256", name: "unlockTime", internalType: "uint256" },
      ],
      name: "lockedTokens",
      inputs: [
        { type: "address", name: "", internalType: "address" },
        { type: "uint256", name: "", internalType: "uint256" },
      ],
    },
    {
      type: "function",
      stateMutability: "nonpayable",
      outputs: [],
      name: "withdrawTokens",
      inputs: [{ type: "uint256", name: "index", internalType: "uint256" }],
    },
  ];
  
export const decentLockerCA = "0x1b94eAC8224a457A0dB5e7C88c6F540F43a1071b";
  
// ///////////////// DECENT TOKEN CREATOR //////////////////////
export const decentTokenCreatorABI = [
    {
      inputs: [
        {
          internalType: "string",
          name: "_name",
          type: "string",
        },
        {
          internalType: "string",
          name: "_symbol",
          type: "string",
        },
        {
          internalType: "uint256",
          name: "_totalSupply",
          type: "uint256",
        },
        {
          internalType: "address",
          name: "initialOwner",
          type: "address",
        },
      ],
      stateMutability: "nonpayable",
      type: "constructor",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "owner",
          type: "address",
        },
      ],
      name: "OwnableInvalidOwner",
      type: "error",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "account",
          type: "address",
        },
      ],
      name: "OwnableUnauthorizedAccount",
      type: "error",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "owner",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "spender",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "value",
          type: "uint256",
        },
      ],
      name: "Approval",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "previousOwner",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "newOwner",
          type: "address",
        },
      ],
      name: "OwnershipTransferred",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "from",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "to",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "value",
          type: "uint256",
        },
      ],
      name: "Transfer",
      type: "event",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "owner",
          type: "address",
        },
        {
          internalType: "address",
          name: "spender",
          type: "address",
        },
      ],
      name: "allowance",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "spender",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "value",
          type: "uint256",
        },
      ],
      name: "approve",
      outputs: [
        {
          internalType: "bool",
          name: "",
          type: "bool",
        },
      ],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "account",
          type: "address",
        },
      ],
      name: "balanceOf",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "decimals",
      outputs: [
        {
          internalType: "uint8",
          name: "",
          type: "uint8",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "spender",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "subtractedValue",
          type: "uint256",
        },
      ],
      name: "decreaseAllowance",
      outputs: [
        {
          internalType: "bool",
          name: "",
          type: "bool",
        },
      ],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "spender",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "addedValue",
          type: "uint256",
        },
      ],
      name: "increaseAllowance",
      outputs: [
        {
          internalType: "bool",
          name: "",
          type: "bool",
        },
      ],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [],
      name: "name",
      outputs: [
        {
          internalType: "string",
          name: "",
          type: "string",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "owner",
      outputs: [
        {
          internalType: "address",
          name: "",
          type: "address",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "renounceOwnership",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [],
      name: "symbol",
      outputs: [
        {
          internalType: "string",
          name: "",
          type: "string",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "totalSupply",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "to",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "value",
          type: "uint256",
        },
      ],
      name: "transfer",
      outputs: [
        {
          internalType: "bool",
          name: "",
          type: "bool",
        },
      ],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "from",
          type: "address",
        },
        {
          internalType: "address",
          name: "to",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "value",
          type: "uint256",
        },
      ],
      name: "transferFrom",
      outputs: [
        {
          internalType: "bool",
          name: "",
          type: "bool",
        },
      ],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "newOwner",
          type: "address",
        },
      ],
      name: "transferOwnership",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
  ];
  
export const decentTokenCreatorByteCode =
    "608060405234801561001057600080fd5b50604051610e70380380610e7083398101604081905261002f916101ea565b806001600160a01b03811661005e57604051631e4fbdf760e01b81526000600482015260240160405180910390fd5b610067816100e1565b506001805560026100788582610306565b5060036100858482610306565b5060048290556001600160a01b0381166000818152600560209081526040808320869055518581527fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef910160405180910390a3505050506103c4565b600080546001600160a01b038381166001600160a01b0319831681178455604051919092169283917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09190a35050565b634e487b7160e01b600052604160045260246000fd5b600082601f83011261015857600080fd5b81516001600160401b0381111561017157610171610131565b604051601f8201601f19908116603f011681016001600160401b038111828210171561019f5761019f610131565b6040528181528382016020018510156101b757600080fd5b60005b828110156101d6576020818601810151838301820152016101ba565b506000918101602001919091529392505050565b6000806000806080858703121561020057600080fd5b84516001600160401b0381111561021657600080fd5b61022287828801610147565b602087015190955090506001600160401b0381111561024057600080fd5b61024c87828801610147565b60408701516060880151919550935090506001600160a01b038116811461027257600080fd5b939692955090935050565b600181811c9082168061029157607f821691505b6020821081036102b157634e487b7160e01b600052602260045260246000fd5b50919050565b601f82111561030157806000526020600020601f840160051c810160208510156102de5750805b601f840160051c820191505b818110156102fe57600081556001016102ea565b50505b505050565b81516001600160401b0381111561031f5761031f610131565b6103338161032d845461027d565b846102b7565b6020601f821160018114610367576000831561034f5750848201515b600019600385901b1c1916600184901b1784556102fe565b600084815260208120601f198516915b828110156103975787850151825560209485019460019092019101610377565b50848210156103b55786840151600019600387901b60f8161c191681555b50505050600190811b01905550565b610a9d806103d36000396000f3fe608060405234801561001057600080fd5b50600436106100ea5760003560e01c8063715018a61161008c578063a457c2d711610066578063a457c2d7146101dd578063a9059cbb146101f0578063dd62ed3e14610203578063f2fde38b1461023c57600080fd5b8063715018a6146101b05780638da5cb5b146101ba57806395d89b41146101d557600080fd5b806323b872dd116100c857806323b872dd14610147578063313ce5671461015a578063395093511461017457806370a082311461018757600080fd5b806306fdde03146100ef578063095ea7b31461010d57806318160ddd14610130575b600080fd5b6100f761024f565b604051610104919061088f565b60405180910390f35b61012061011b3660046108f9565b6102dd565b6040519015158152602001610104565b61013960045481565b604051908152602001610104565b610120610155366004610923565b61034a565b610162601281565b60405160ff9091168152602001610104565b6101206101823660046108f9565b6104b5565b610139610195366004610960565b6001600160a01b031660009081526005602052604090205490565b6101b8610546565b005b6000546040516001600160a01b039091168152602001610104565b6100f7610558565b6101206101eb3660046108f9565b610565565b6101206101fe3660046108f9565b610619565b61013961021136600461097b565b6001600160a01b03918216600090815260066020908152604080832093909416825291909152205490565b6101b861024a366004610960565b6106bf565b6002805461025c906109ae565b80601f0160208091040260200160405190810160405280929190818152602001828054610288906109ae565b80156102d55780601f106102aa576101008083540402835291602001916102d5565b820191906000526020600020905b8154815290600101906020018083116102b857829003601f168201915b505050505081565b3360008181526006602090815260408083206001600160a01b038716808552925280832085905551919290917f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925906103389086815260200190565b60405180910390a35060015b92915050565b60006103546106fd565b6001600160a01b0383166103835760405162461bcd60e51b815260040161037a906109e8565b60405180910390fd5b6001600160a01b0384166000908152600560205260409020548211156103eb5760405162461bcd60e51b815260206004820152601b60248201527f45524332303a20696e73756666696369656e742062616c616e63650000000000604482015260640161037a565b6001600160a01b038416600090815260066020908152604080832033845290915290205482111561045e5760405162461bcd60e51b815260206004820152601d60248201527f45524332303a20696e73756666696369656e7420616c6c6f77616e6365000000604482015260640161037a565b6001600160a01b038416600090815260066020908152604080832033845290915281208054849290610491908490610a41565b909155506104a29050848484610756565b5060016104ae60018055565b9392505050565b3360009081526006602090815260408083206001600160a01b03861684529091528120805483919083906104ea908490610a54565b90915550503360008181526006602090815260408083206001600160a01b038816808552908352928190205490519081529192917f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b9259101610338565b61054e610804565b610556610831565b565b6003805461025c906109ae565b3360009081526006602090815260408083206001600160a01b03861684529091528120548211156105e65760405162461bcd60e51b815260206004820152602560248201527f45524332303a2064656372656173656420616c6c6f77616e63652062656c6f77604482015264207a65726f60d81b606482015260840161037a565b3360009081526006602090815260408083206001600160a01b0387168452909152812080548492906104ea908490610a41565b60006106236106fd565b6001600160a01b0383166106495760405162461bcd60e51b815260040161037a906109e8565b336000908152600560205260409020548211156106a85760405162461bcd60e51b815260206004820152601b60248201527f45524332303a20696e73756666696369656e742062616c616e63650000000000604482015260640161037a565b6106b3338484610756565b50600161034460018055565b6106c7610804565b6001600160a01b0381166106f157604051631e4fbdf760e01b81526000600482015260240161037a565b6106fa8161083f565b50565b60026001540361074f5760405162461bcd60e51b815260206004820152601f60248201527f5265656e7472616e637947756172643a207265656e7472616e742063616c6c00604482015260640161037a565b6002600155565b6001600160a01b0383166000908152600560205260408120805483929061077e908490610a41565b90915550506001600160a01b038216600090815260056020526040812080548392906107ab908490610a54565b92505081905550816001600160a01b0316836001600160a01b03167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef836040516107f791815260200190565b60405180910390a3505050565b6000546001600160a01b031633146105565760405163118cdaa760e01b815233600482015260240161037a565b610839610804565b61055660005b600080546001600160a01b038381166001600160a01b0319831681178455604051919092169283917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09190a35050565b602081526000825180602084015260005b818110156108bd57602081860181015160408684010152016108a0565b506000604082850101526040601f19601f83011684010191505092915050565b80356001600160a01b03811681146108f457600080fd5b919050565b6000806040838503121561090c57600080fd5b610915836108dd565b946020939093013593505050565b60008060006060848603121561093857600080fd5b610941846108dd565b925061094f602085016108dd565b929592945050506040919091013590565b60006020828403121561097257600080fd5b6104ae826108dd565b6000806040838503121561098e57600080fd5b610997836108dd565b91506109a5602084016108dd565b90509250929050565b600181811c908216806109c257607f821691505b6020821081036109e257634e487b7160e01b600052602260045260246000fd5b50919050565b60208082526023908201527f45524332303a207472616e7366657220746f20746865207a65726f206164647260408201526265737360e81b606082015260800190565b634e487b7160e01b600052601160045260246000fd5b8181038181111561034457610344610a2b565b8082018082111561034457610344610a2b56fea2646970667358221220b36be99bbdad0c45468e68e4566bd17effb1ccad9ecb85bac985b9945d6f565a64736f6c634300081a0033";
  
// //////////////////////////////////////////////////////////////////////////////////////////////////////////
export const decentBulSenderCA = "0x658d7937adc310661391944e152a5e6115ef1119";

  export const decentBulkSenderABI = [
    { inputs: [], stateMutability: "nonpayable", type: "constructor" },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "token",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "sender",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "totalRecipients",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "totalAmount",
          type: "uint256",
        },
      ],
      name: "BulkTransfer",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "previousOwner",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "newOwner",
          type: "address",
        },
      ],
      name: "OwnershipTransferred",
      type: "event",
    },
    {
      inputs: [],
      name: "MAX_ADDRESSES",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        { internalType: "address", name: "token", type: "address" },
        { internalType: "address[]", name: "recipients", type: "address[]" },
        { internalType: "uint256[]", name: "amounts", type: "uint256[]" },
      ],
      name: "bulkSend",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [],
      name: "owner",
      outputs: [{ internalType: "address", name: "", type: "address" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [{ internalType: "address", name: "newOwner", type: "address" }],
      name: "transferOwnership",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
  ];
  
///////////////////////////////////////////////////DECENT DONATION DETAILS ///////////////////////////////////////////////
export const decentDonationABI = [{"inputs":[{"internalType":"address","name":"_feeRecipient","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"id","type":"uint256"},{"indexed":true,"internalType":"address","name":"creator","type":"address"},{"indexed":false,"internalType":"string","name":"title","type":"string"},{"indexed":false,"internalType":"uint256","name":"goal","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"DonationCreated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"id","type":"uint256"},{"indexed":true,"internalType":"address","name":"donor","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"blockNumber","type":"uint256"}],"name":"DonationReceived","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"id","type":"uint256"},{"indexed":true,"internalType":"address","name":"creator","type":"address"},{"indexed":false,"internalType":"uint256","name":"amountAfterFee","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"fee","type":"uint256"}],"name":"DonationWithdrawn","type":"event"},{"inputs":[],"name":"PLATFORM_FEE_BPS","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"_title","type":"string"},{"internalType":"string","name":"_description","type":"string"},{"internalType":"uint256","name":"_goalAmount","type":"uint256"},{"internalType":"uint256","name":"_durationInSeconds","type":"uint256"}],"name":"createDonation","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"creatorToDonationIds","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_id","type":"uint256"}],"name":"donate","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"donationCounter","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"donations","outputs":[{"internalType":"address payable","name":"creator","type":"address"},{"internalType":"string","name":"title","type":"string"},{"internalType":"string","name":"description","type":"string"},{"internalType":"uint256","name":"goalAmount","type":"uint256"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint256","name":"totalRaised","type":"uint256"},{"internalType":"bool","name":"withdrawn","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"donorsOfDonation","outputs":[{"internalType":"address","name":"donor","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"feeRecipient","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_id","type":"uint256"}],"name":"getDonorsForDonation","outputs":[{"components":[{"internalType":"address","name":"donor","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"internalType":"struct DecentGiver.DonorInfo[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getMyDonations","outputs":[{"internalType":"uint256[]","name":"","type":"uint256[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_id","type":"uint256"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"}]

export const decentDonationCA = "0x372660e6707Bd475Ca75cF297937AA6Ba560E715"
