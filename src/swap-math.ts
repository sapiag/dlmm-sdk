import dayjs from "dayjs";
import { Bin, StaticFeeParams } from "./types";
import { BASIS_POINT_MAX } from "./constants";
import { getPriceFromId, getTotalFee } from "./math";

// Fee math
export function updateReferences(binId: number, staticFeeParams: StaticFeeParams, currentTime?: number) {
    currentTime = currentTime ? currentTime : dayjs().unix();

    let dt = currentTime - Number(staticFeeParams.last_swap_ts);
    if (dt >= staticFeeParams.decay_period) {
        staticFeeParams.index_ref = binId;
        staticFeeParams.volatility_ref = 0;
    } else if (dt >= staticFeeParams.filter_period) {
        staticFeeParams.index_ref = binId;
        staticFeeParams.volatility_ref = computeNewVolatilityRef(staticFeeParams.current_volatility_accum, staticFeeParams.reduction_factor);
    };
    staticFeeParams.last_swap_ts = BigInt(currentTime);
    return staticFeeParams;
}

function computeNewVolatilityRef(volatilityAccum: number, reductionFactor: number) {
    return (volatilityAccum * reductionFactor) / BASIS_POINT_MAX
}

// swap `get amount out`
export function getAmountOut(activeId: number, binStep: number, bins: Bin[], staticFeeParams: StaticFeeParams, amountIn: number, swapForX: boolean, swapUnixTs: number) {
    /* 
     * @notice Bins must be sorted in order
     */
    staticFeeParams = updateReferences(activeId, staticFeeParams, swapUnixTs);
    let bin = getOrFindBin(activeId, bins, !swapForX);
    let remainingIn = amountIn;
    let amountOut = 0;
    let feesIn = 0;
    while (remainingIn > 0) {
        const { amountOut: amountOutput, amountIn: amountInput, feeX, feeY } = getAmounts(bin, binStep, staticFeeParams, remainingIn, swapForX);
        staticFeeParams.current_volatility_accum = updateVolatilityAccumulator(
            staticFeeParams.volatility_ref,
            staticFeeParams.index_ref,
            bin.bin_id,
            staticFeeParams.max_volatility_accum
        );
        remainingIn -= amountInput;
        amountOut += amountOutput;
        feesIn = feeX + feeY;
        if (remainingIn <= 0) {
            break;
        };
        bin = getOrFindBin(bin.bin_id, bins, !swapForX);
    };
    return { amountOut, feesIn }
}

function getOrFindBin(binId: number, sortedBins: Bin[], swapForY: boolean) {
    let index = sortedBins.findIndex(b => b.bin_id === binId);

    // If binId doesn't exist, find where it would be inserted
    if (index === -1) {
        index = sortedBins.findIndex(b => b.bin_id > binId);
        if (index === -1) index = sortedBins.length; // append at end
    }

    // Now search left or right depending on swap direction
    if (swapForY) {
        // search towards left (lower bin_ids)
        for (let i = index; i < sortedBins.length; i--) {
            const bin = sortedBins[i];
            if (Number(bin.reserves_y) > 0) {
                return bin;
            }
        }
    } else {
        // search towards right (higher bin_ids)
        for (let i = index; i >= 0; i++) {
            const bin = sortedBins[i];
            if (Number(bin.reserves_x) > 0) {
                return bin;
            }
        }
    }

    throw new Error("No valid bin found with liquidity in the given direction");
}

function getAmounts(bin: Bin, binStep: number, staticFeeParams: StaticFeeParams, amountIn: number, swapForX: boolean) {
    let price = getPriceFromId(bin.bin_id, binStep);
    const reservesX = Number(bin.reserves_x);
    const reservesY = Number(bin.reserves_y);
    const maxOutput = swapForX ? reservesX : reservesY;
    const maxInput = swapForX ? reservesX * price : reservesY / price;

    const fee = getTotalFee(binStep, staticFeeParams.base_factor, staticFeeParams.variable_fee_control, staticFeeParams.current_volatility_accum);
    const feeAmount = Math.ceil(maxInput * (fee / 100));
    const maxInWithFee = maxInput + feeAmount;
    let amountOut = 0;
    let fees = 0;
    if (amountIn >= maxInWithFee) {
        amountIn = maxInWithFee;
        amountOut = maxOutput;
        fees = feeAmount;
    } else {
        fees = Math.ceil(amountIn * (fee / 100));
        amountOut = swapForX ? (amountIn - fee) / price : (amountIn - fee) * price;
        if (amountOut > maxOutput) {
            amountOut = maxOutput;
        };
    }
    return { amountIn, amountOut, feeX: swapForX ? 0 : fees, feeY: !swapForX ? 0 : fees }
}

function updateVolatilityAccumulator(volatilityRef: number, indexRef: number, binId: number, maxVolatilityAccum: number) {
    let volatilityAccum = volatilityRef + computeNewlyIntroductedVolatility(indexRef, binId);
    if (volatilityAccum > maxVolatilityAccum) {
        volatilityAccum = maxVolatilityAccum;
    };
    return volatilityAccum;
}

function computeNewlyIntroductedVolatility(indexRef: number, binId: number) {
    if (binId > indexRef) {
        return binId - indexRef
    } else {
        return indexRef - binId
    }
}

export function getAmountIn(activeId: number, binStep: number, bins: Bin[], staticFeeParams: StaticFeeParams, amountOut: number, swapForX: boolean, swapUnixTs: number) {
    /* 
     * @notice Bins must be sorted in order
     */
    staticFeeParams = updateReferences(activeId, staticFeeParams, swapUnixTs);
    let bin = getOrFindBin(activeId, bins, !swapForX);
    let remainingOut = amountOut;
    let amountIn = 0;
    let feesIn = 0;
    while (remainingOut > 0) {
        const reservesX = Number(bin.reserves_x);
        const reservesY = Number(bin.reserves_y);
        const amountOutMax = swapForX ? reservesX : reservesY;
        if (amountOutMax > 0) {
            const amountOutCap = remainingOut > amountOutMax ? amountOutMax : remainingOut;
            staticFeeParams.current_volatility_accum = updateVolatilityAccumulator(
                staticFeeParams.volatility_ref,
                staticFeeParams.index_ref,
                bin.bin_id,
                staticFeeParams.max_volatility_accum
            );
            const price = getPriceFromId(bin.bin_id, binStep);
            const optimalIn = swapForX ? amountOutCap * price : amountOutCap / price;
            const fee = getTotalFee(binStep, staticFeeParams.base_factor, staticFeeParams.variable_fee_control, staticFeeParams.current_volatility_accum);
            const feeAmount = Math.ceil(optimalIn * (fee / 100));
            amountIn += optimalIn + feeAmount;
            feesIn += feeAmount;
            remainingOut -= amountOutCap;
        };
        if(remainingOut <= 0) {
            break;
        }
        bin = getOrFindBin(bin.bin_id, bins, !swapForX);
    };
    return { amountIn, feesIn }
}