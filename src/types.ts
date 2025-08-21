export interface Pagination {
    offset: number;
    limit: number;
    total: number;
    has_more: boolean;
}

export interface DlmmPool {
    addr: string;
    x_addr: string;
    y_addr: string;
    active_bin_id: number;
    bin_step: number;
    collection_name: string;
    collection_addr: string;
    reserves_x: bigint;
    reserves_y: bigint;
    locked: boolean;
    ts: bigint;
    tx_version: bigint;
    static_fee_params: StaticFeeParams;
}

type StaticFeeParams = {
    base_factor: bigint;
    filter_period: bigint;
    decay_period: bigint;
    reduction_factor: number;
    variable_fee_control: number;
    protocol_share: bigint;
    max_volatility_accum: number;
    current_volatility_accum: number;
    index_ref: number;
    volatility_ref: number;
    last_swap_ts: bigint;
}

type Bin = {
    pool_addr: string;
    bin_id: number;
    fee_growth_x: number;
    fee_growth_y: number;
    liquidity_gross: number;
    reserves_x: number;
    reserves_y: number;
}