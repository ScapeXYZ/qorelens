// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IPqcKeyStatus {
    function pqcKeyStatus(address account)
        external
        view
        returns (bool registered, uint8 algorithmId, bytes memory pubkey, bool possessionProven);
}

contract QoreLensProbe is IPqcKeyStatus {
    IPqcKeyStatus private constant REGISTRY =
        IPqcKeyStatus(address(uint160(0x0a02)));

    function pqcKeyStatus(address account)
        external
        view
        returns (bool registered, uint8 algorithmId, bytes memory pubkey, bool possessionProven)
    {
        return REGISTRY.pqcKeyStatus(account);
    }
}
