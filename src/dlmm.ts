import { Network, InputEntryFunctionData } from "@aptos-labs/ts-sdk"

type Config = {
    network: Network;
}

export class Dlmm {
    network: Network;
    constructor(config: Config) {
        this.network = config.network;
    }
    createPoolPayload(): InputEntryFunctionData {
        return {
            function: "0x1::test::test",
            typeArguments: [],
            functionArguments: []
        }
    }
}