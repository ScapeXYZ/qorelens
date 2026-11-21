// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IPqcKeyStatus, QoreLensProbe} from "../contracts/QoreLensProbe.sol";

interface Vm {
    function etch(address target, bytes calldata code) external;
    function mockCall(address target, bytes calldata data, bytes calldata result) external;
}

contract QoreLensProbeTest {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant REGISTRY = address(uint160(0x0a02));

    function testForwardsFourFieldResponse() public {
        address account = address(0x1234);
        bytes memory expectedKey = hex"010203";
        VM.etch(REGISTRY, hex"00");
        VM.mockCall(
            REGISTRY,
            abi.encodeCall(IPqcKeyStatus.pqcKeyStatus, (account)),
            abi.encode(true, uint8(1), expectedKey, true)
        );
        QoreLensProbe probe = new QoreLensProbe();
        (bool registered, uint8 algorithmId, bytes memory key, bool proven) =
            probe.pqcKeyStatus(account);
        require(registered && algorithmId == 1 && proven, "registry metadata");
        require(keccak256(key) == keccak256(expectedKey), "registry key");
    }

    function testForwardsUnregisteredResponse() public {
        address account = address(0x4321);
        VM.etch(REGISTRY, hex"00");
        VM.mockCall(
            REGISTRY,
            abi.encodeCall(IPqcKeyStatus.pqcKeyStatus, (account)),
            abi.encode(false, uint8(0), bytes(""), false)
        );
        QoreLensProbe probe = new QoreLensProbe();
        (bool registered, uint8 algorithmId, bytes memory key, bool proven) =
            probe.pqcKeyStatus(account);
        require(!registered && algorithmId == 0 && key.length == 0 && !proven, "unregistered");
    }
}
