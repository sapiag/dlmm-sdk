import { Network, InputEntryFunctionData } from "@aptos-labs/ts-sdk"
import { BASIS_POINT_MAX, MAX_BIN_ID, MAX_FEE, MAX_PROTOCOL_SHARE } from "./constants";
import { DlmmPool, Pagination } from "./types";

type Config = {
    network: Network;
}

export class Dlmm {
    private abi: string;
    private api: string;
    constructor(config: Config) {
        if (config.network === "mainnet") {
            this.abi = "0xMAINNET_ABI"; // TODO: replace with actual mainnet ABI
            this.api = "https://api.example.com"
        } else if (config.network == "testnet") {
            this.abi = "0x2df8661f20dd7318c6d929958640a589368212534c6e208efb5632a91dd9e2fd";
            this.api = "https://api.sapi.ag"
        } else {
            throw "Only testnet and mainnet networks are allowed";
        };
    }
    createPool(
        tokenX: string,
        tokenY: string,
        activeId: number,
        binStep: number,
        baseFactor: number,
        filterPeriod: number,
        decayPeriod: number,
        reductionFactor: number,
        variableFeeControl: number,
        maxVolatilityAccum: number,
        protocolShare: number = 2000,
    ): InputEntryFunctionData {
        /**
         * Creates a pool if doesn't exist.
         * 
         * @param tokenX - Address of token X.
         * @param tokenY - Address of token Y.
         * @param activeId - The bin ID derived from initial price (from `getIdFromPrice`).
         * @param binStep - The bin step for the pair (price granularity).
         * @param baseFactor - Base factor used for fee calculations (from `getBaseFactor`).
         * @param filterPeriod - Period in seconds for volatility filter.
         * @param decayPeriod - Period in seconds for volatility decay.
         * @param reductionFactor - Factor for reducing volatility impact.
         * @param variableFeeControl - Control factor for variable fee adjustments.
         * @param maxVolatilityAccum - Maximum allowed volatility accumulation.
         * @param protocolShare - Protocol fee share (default: 2000 = 20%).
         * @returns InputEntryFunctionData payload for creating the pool.
         */
        if (activeId > MAX_BIN_ID) throw `Bin id must be less than or equal to ${MAX_BIN_ID}`;
        if (binStep === 0 || binStep > BASIS_POINT_MAX) throw `Bin step must be greater than 0 and less than ${BASIS_POINT_MAX}`;
        if (binStep * baseFactor * 1e10 > MAX_FEE) throw `Fee must be less than or equal to 10%`;
        if (filterPeriod < decayPeriod) throw `Filter period must be less than decay period`;
        if (reductionFactor > BASIS_POINT_MAX) throw `Reduction factor must be less than or equal to ${BASIS_POINT_MAX}`;
        if (protocolShare > MAX_PROTOCOL_SHARE) throw `Protocol fee must be less than or equal to ${MAX_PROTOCOL_SHARE}`;
        return {
            function: `${this.abi}::scripts::register_pool_with_params`,
            typeArguments: [],
            functionArguments: [tokenX, tokenY, activeId, binStep, baseFactor, filterPeriod, decayPeriod, reductionFactor, variableFeeControl, maxVolatilityAccum, protocolShare]
        }
    }
    addLiquidity(
        poolObj: string,
        amountX: number,
        amountY: number,
        defaultIds: number[],
        activeIdDesired: number,
        idSlippage: number,
        distributionX: number[],
        distributionY: number[],
        amountXmin: number,
        amountYmin: number,
    ) {
        /**
         * Adds liquidity into an existing pool across multiple bins.
         * 
         * @param poolObj - Pool object address where liquidity is being added.
         * @param amountX - Total amount of token X to deposit.
         * @param amountY - Total amount of token Y to deposit.
         * @param defaultIds - List of bin IDs where liquidity will be distributed.
         * @param activeIdDesired - Desired active bin ID for liquidity placement.
         * @param idSlippage - Maximum allowed deviation (slippage) from the desired bin ID.
         * @param distributionX - Distribution amounts of token X across bins.
         * @param distributionY - Distribution amounts of token Y across bins.
         * @param amountXmin - Minimum amount of token X to accept (slippage protection).
         * @param amountYmin - Minimum amount of token Y to accept (slippage protection).
         * @returns InputEntryFunctionData payload for adding liquidity.
         */
        const arrLen = defaultIds.length;
        if (arrLen !== distributionX.length || arrLen !== distributionY.length) throw `Ids and distributions length must be same`;
        if (activeIdDesired > MAX_BIN_ID) throw `activeIdDesired must be less than or equal to ${MAX_BIN_ID}`;
        if (idSlippage > MAX_BIN_ID) throw `idSlippage must be less than or equal to ${MAX_BIN_ID}`;
        if (amountXmin > amountX) throw `amountXmin must be less than or equal to amountX`;
        if (amountYmin > amountY) throw `amountYmin must be less than or equal to amountY`;
        return {
            function: `${this.abi}::scripts::add_liquidity`,
            typeArguments: [],
            functionArguments: [poolObj, amountX, amountY, defaultIds, activeIdDesired, idSlippage, distributionX, distributionY, amountXmin, amountYmin]
        }
    }
    updateLiquidity(
        positionToken: string,
        amountX: number,
        amountY: number,
        distributionX: number[],
        distributionY: number[],
        amountXmin: number,
        amountYmin: number,
    ) {
        /**
         * Updates liquidity into an existing position.
         * 
         * @notice Length of distributionX and distributionY must be equal to bin ids in the position
         * @param positionToken - Position token received while adding liquidity.
         * @param amountX - Total amount of token X to deposit.
         * @param amountY - Total amount of token Y to deposit.
         * @param distributionX - Distribution amounts of token X across bins.
         * @param distributionY - Distribution amounts of token Y across bins.
         * @param amountXmin - Minimum amount of token X to accept (slippage protection).
         * @param amountYmin - Minimum amount of token Y to accept (slippage protection).
         * @returns InputEntryFunctionData payload for updating liquidity.
         */
        if (amountXmin > amountX) throw `amountXmin must be less than or equal to amountX`;
        if (amountYmin > amountY) throw `amountYmin must be less than or equal to amountY`;
        return {
            function: `${this.abi}::scripts::update_liquidity`,
            typeArguments: [],
            functionArguments: [positionToken, amountX, amountY, distributionX, distributionY, amountXmin, amountYmin]
        }
    }
    withdrawLiquidity(
        positionToken: string,
        withdrawPercentages: number[],
        withdrawTokenX: boolean,
        withdrawTokenY: boolean,
        _amountXmin: number,
        _amountYmin: number
    ) {
        /**
         * Withdraw liquidity from an existing position.
         * 
         * @notice Length of withdrawPercentages must be equal to bin ids in the position
         * @param positionToken - Position token received while adding liquidity.
         * @param withdrawPercentages - The percentages in bps to withdraw.
         * @param withdrawTokenX - Whether to withdraw X from activeId and right side of active id.
         * @param withdrawTokenY - Whether to withdraw Y from activeId and left side of active id.
         * @param amountXmin - Minimum token X amount to receive.
         * @param amountYmin - Minimum token Y amount to receive.
         * @returns InputEntryFunctionData payload for withdraw liquidity.
         */
        return {
            function: `${this.abi}::scripts::withdraw_liquidity`,
            typeArguments: [],
            functionArguments: [positionToken, withdrawPercentages, withdrawTokenX, withdrawTokenY]
        }
    }
    removeLiquidity(
        positionToken: string,
        _amountXmin: number,
        _amountYmin: number
    ) {
        /**
         * Removes liquidity from an existing position.
         * 
         * @param positionToken - Position token received while adding liquidity.
         * @param amountXmin - Minimum token X amount to receive.
         * @param amountYmin - Minimum token Y amount to receive.
         * @returns InputEntryFunctionData payload for withdraw liquidity.
         */
        return {
            function: `${this.abi}::scripts::remove_liquidity`,
            typeArguments: [],
            functionArguments: [positionToken]
        }
    }
    claimFees(
        positionToken: string,
        _amountXmin: number,
        _amountYmin: number
    ) {
        /**
         * Claims fees from an existing position.
         * 
         * @param positionToken - Position token received while adding liquidity.
         * @param amountXmin - Minimum token X amount to receive.
         * @param amountYmin - Minimum token Y amount to receive.
         * @returns InputEntryFunctionData payload for claim fees.
         */
        return {
            function: `${this.abi}::scripts::claim_fees`,
            typeArguments: [],
            functionArguments: [positionToken]
        }
    }
    claimFeesMultiple(
        positionTokens: string[],
        recipients: string[]
    ) {
        /**
         * Claims fees from multiple existing positions.
         * 
         * @notice Only callable by the owner of the positions
         * @param positionToken - Position token received while adding liquidity.
         * @param recipients - Fee receiver addresses.
         * @returns InputEntryFunctionData payload for claim fees multiple.
         */
        return {
            function: `${this.abi}::scripts::claim_fees_multiple`,
            typeArguments: [],
            functionArguments: [positionTokens, recipients]
        }
    }
    swapExactXForY(
        poolObj: string,
        amountX: number,
        amountYDesired: number
    ) {
        /**
         * Swap exact token X for token Y.
         * 
         * @param poolObj - Pool object address where swap occurs.
         * @param amountX - The exact amount of token X.
         * @param amountYDesired - The desired amount of token Y to receive.
         * @returns InputEntryFunctionData payload for swap exact token X for token Y.
         */
        return {
            function: `${this.abi}::scripts::swap_exact_x_for_y`,
            typeArguments: [],
            functionArguments: [poolObj, amountX, amountYDesired]
        }
    }
    swapExactYForX(
        poolObj: string,
        amountY: number,
        amountXDesired: number
    ) {
        /**
         * Swap exact token Y for token X.
         * 
         * @param poolObj - Pool object address where swap occurs.
         * @param amountY - The exact amount of token Y.
         * @param amountXDesired - The desired amount of token X to receive.
         * @returns InputEntryFunctionData payload for swap exact token Y for token X.
         */
        return {
            function: `${this.abi}::scripts::swap_exact_y_for_x`,
            typeArguments: [],
            functionArguments: [poolObj, amountY, amountXDesired]
        }
    }
    swapXForExactY(
        poolObj: string,
        amountX: number,
        amountYExact: number
    ) {
        /**
         * Swap token X for exact token Y.
         * 
         * @param poolObj - Pool object address where swap occurs.
         * @param amountX - The amount of token X.
         * @param amountYExact - The exact amount of token Y to receive.
         * @returns InputEntryFunctionData payload for swap token X for exact token Y.
         */
        return {
            function: `${this.abi}::scripts::swap_x_for_exact_y`,
            typeArguments: [],
            functionArguments: [poolObj, amountX, amountYExact]
        }
    }
    swapYForExactX(
        poolObj: string,
        amountY: number,
        amountXExact: number
    ) {
        /**
         * Swap token Y for exact token X.
         * 
         * @param poolObj - Pool object address where swap occurs.
         * @param amountY - The amount of token Y.
         * @param amountXExact - The exact amount of token X to receive.
         * @returns InputEntryFunctionData payload for swap token Y for exact token X.
         */
        return {
            function: `${this.abi}::scripts::swap_y_for_exact_x`,
            typeArguments: [],
            functionArguments: [poolObj, amountY, amountXExact]
        }
    }
    async getPools(
        addr?: string,
        token?: string,
        offset: number = 0,
        limit: number = 10,
    ): Promise<{ data: DlmmPool[]; pagination: Pagination }> {
        /**
         * Get the list of DLMM pools.
         * 
         * @param addr - (Optional) Specific pool address. If provided, the response will contain this pool at index 0.
         * @param token - (Optional) Token address to filter pools by token.
         * @param offset - Pagination offset (default: 0).
         * @param limit - Pagination limit (default: 10).
         * @returns { data: DlmmPool[], pagination: Pagination } A paginated list of pools.
         */
        const params = new URLSearchParams({
            offset: String(offset),
            limit: String(limit),
        });

        if (addr) params.append("addr", addr);
        if (token) params.append("token", token);

        const res = await fetch(`${this.api}/sdk/dlmm/get-pools?${params.toString()}`);

        if (!res.ok) {
            throw new Error("Unknown API error");
        }

        return (await res.json()) as { data: DlmmPool[]; pagination: Pagination };
    }
}