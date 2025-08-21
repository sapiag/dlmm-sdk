export function getIdFromPrice(price: number, binStep: number) {
    return Math.trunc(Math.log(price) / Math.log(1 + binStep / 10_000)) + 8388608;
}

export function getPriceFromId(binId: number, binStep: number) {
    return (1 + binStep / 10_000) ** (binId - 8388608)
}

export function getBaseFactor(fee: number, binStep: number) {
    const feeAsDecimal = fee / 100;
    const computedBaseFactor = (feeAsDecimal * 1e18) / (binStep * 1e10);
    const computedBaseFactorFloor = Math.floor(computedBaseFactor);
    if (computedBaseFactor !== computedBaseFactorFloor) {
        throw "Couldn't compute base factor for the exact fee"
    }
    return computedBaseFactor
}

export function fromPricePerOctas(decimalsX: number, decimalsY: number, price: number) {
    return price * 10 ** (decimalsX - decimalsY)
}

export function getPricePerOctas(decimalsY: number, decimalsX: number, price: number) {
    return price * 10 ** (decimalsY - decimalsX)
}

export function getBaseFee(baseFactor: number, binStep: number) {
    const baseFeeRaw = baseFactor * binStep * 1e10;
    return (baseFeeRaw / 1e18) * 100;
}


export function getTotalFee(binStep: number, baseFactor: bigint, variableFeeControl: number, currentVolatilityAccum: number) {
    return getBaseFee(binStep, Number(baseFactor)) + getVariableFee(
        binStep,
        variableFeeControl,
        currentVolatilityAccum,
    )
}

export function getVariableFee(binStep: number, variableFeeControl: number, volatilityAccum: number) {
    let fee = 0;
    if(variableFeeControl != 0) {
        const prod = volatilityAccum * binStep;
        fee = (prod * prod * variableFeeControl + 99) / 100
    };
    return (fee / 1e18) * 100
}

