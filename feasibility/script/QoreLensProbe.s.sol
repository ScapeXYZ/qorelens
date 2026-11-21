// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {QoreLensProbe} from "../contracts/QoreLensProbe.sol";

interface DeployVm {
    function envUint(string calldata name) external view returns (uint256);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract QoreLensProbeScript {
    DeployVm private constant VM = DeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (QoreLensProbe probe) {
        require(block.chainid == 9800, "Diana only");
        VM.startBroadcast(VM.envUint("PRIVATE_KEY"));
        probe = new QoreLensProbe();
        VM.stopBroadcast();
    }
}
