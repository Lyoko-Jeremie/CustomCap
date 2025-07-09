import Puzzle from './CryptoPuzzle';
import {
    ready,
    to_base64,
    from_base64,
} from 'libsodium-wrappers';

// https://liyangready.github.io/2016/08/21/%E5%8F%AF%E4%BF%A1%E5%89%8D%E7%AB%AF%E4%B9%8B%E8%B7%AF-pow%E9%AA%8C%E8%AF%81/
// https://aandds.com/blog/time-lock-puzzles.html
// https://d.foresightnews.pro/article/detail/80143

const defaultInnerOptions = {
    /* OPTIONAL OPTIONS */
    primeBits: 100, // Number of bits of entropy that the two internally generated primes will have
    primeRounds: 20, // Number of Miller-Rabin primality checks that the prime numbers will have to pass
    opsPerSecond: 3_300_000, // Rough number of operations per second that the attacker/receiver can perform, 3.3M is around what a MBP M1 Max can do
    /* REQUIRED OPTIONS */
    // duration: 500, // Rough minimum number of milliseconds that this puzzle will be unsolvable for
} as const;

/**
 * POW_DIFFICULTY_TABLE 是一个映射表，用于定义不同难度级别的时间锁谜题（Proof of Work Puzzle）的配置。
 * 算法基础求解计算复杂度参数是参照 MBP M1 Max 的性能来设定的，对标 麒麟 8 Gen 3 。
 * https://www.npmjs.com/package/crypto-puzzle
 */
export const POW_DIFFICULTY_TABLE: Map<number, {
    primeBits: number
    primeRounds: number
    opsPerSecond: number
    duration: number
}> = new Map([
    [0, {
        ...defaultInnerOptions,
        duration: 250,     // 419ms       NodeJS : AMD R7 5700x3D 3.8GHz 128GB DDR4-2666
    }],
    [1, {...defaultInnerOptions, duration: 500,}],      // 826ms
    [2, {...defaultInnerOptions, duration: 1_000,}],    // 1.7s
    // AMD R7 5700x3D : Firefox 3s , Edge 1.7s
    // 华为MateX5 麒麟9000s : Firefox 4.7s   Kiwi 2.5s  Via 2.4s
    // 海信A6 虎贲T7510 : Firefox 12s
    [3, {...defaultInnerOptions, duration: 2_000,}],    // 3s
    [103, {...defaultInnerOptions, duration: 5_000,}],    //
    [4, {...defaultInnerOptions, duration: 4_000,}],    // 6s
    [5, {...defaultInnerOptions, duration: 8_000,}],    // 10+s
    [6, {...defaultInnerOptions, duration: 16_000,}],
    [7, {...defaultInnerOptions, duration: 32_000,}],
    [8, {...defaultInnerOptions, duration: 64_000,}],   // 110s : 2m
    [9, {...defaultInnerOptions, duration: 128_000,}],
    [10, {...defaultInnerOptions, duration: 256_000,}],
    [11, {...defaultInnerOptions, duration: 512_000,}],
    [12, {...defaultInnerOptions, duration: 1_024_000,}],
    [13, {...defaultInnerOptions, duration: 2_048_000,}],
    [14, {...defaultInnerOptions, duration: 4_096_000,}],
    [15, {...defaultInnerOptions, duration: 8_192_000,}],
    [16, {...defaultInnerOptions, duration: 16_384_000,}],
    [17, {...defaultInnerOptions, duration: 32_768_000,}],
    [18, {...defaultInnerOptions, duration: 65_536_000,}],  // 18h
    [19, {...defaultInnerOptions, duration: 131_072_000,}],
    [20, {...defaultInnerOptions, duration: 262_144_000,}],
    [21, {...defaultInnerOptions, duration: 524_288_000,}],
    [22, {...defaultInnerOptions, duration: 1_048_576_000,}],
    [23, {...defaultInnerOptions, duration: 2_097_152_000,}],
    [24, {...defaultInnerOptions, duration: 4_194_304_000,}],
    [25, {...defaultInnerOptions, duration: 8_388_608_000,}],
    [26, {...defaultInnerOptions, duration: 16_777_216_000,}],
    [27, {...defaultInnerOptions, duration: 33_554_432_000,}],
    [28, {...defaultInnerOptions, duration: 67_108_864_000,}],
    [29, {...defaultInnerOptions, duration: 134_217_728_000,}],
    [30, {...defaultInnerOptions, duration: 268_435_456_000,}],
]);

/**
 * 生成一个时间锁谜题（Proof of Work Puzzle）
 * @param messageData   保存在谜题中的消息数据，对应在客户端PoW验证后需要返回给服务器的消息，服务器通过验证谜题的解是否与保存的消息一致来确认客户端的工作量证明。
 * @param difficulty    难度级别，对应POW_DIFFICULTY_TABLE中的配置。
 *                      对于正常的登录验证，选 0 。对于发送邮件验证码，选 1 。对于发送短信验证码，至少选 3 。
 */
export async function generatePoWPuzzle(
    messageData: string,
    difficulty: number = 1,
) {
    await ready;
    const options = POW_DIFFICULTY_TABLE.get(difficulty);
    if (!options) {
        console.error('[generatePoWPuzzle] Invalid difficulty level:', difficulty);
        throw new Error(`[generatePoWPuzzle] Invalid difficulty level: ${difficulty}`);
    }

    // 创建一个新的时间锁谜题实例
    const puzzleS = await Puzzle.generate({
        // /* OPTIONAL OPTIONS */
        // primeBits: 100, // Number of bits of entropy that the two internally generated primes will have
        // primeRounds: 20, // Number of Miller-Rabin primality checks that the prime numbers will have to pass
        // opsPerSecond: 3_300_000, // Rough number of operations per second that the attacker/receiver can perform, 3.3M is around what a MBP M1 Max can do
        // /* REQUIRED OPTIONS */
        // duration: 3_000, // Rough minimum number of milliseconds that this puzzle will be unsolvable for
        ...options,
        message: messageData // Message to encrypt inside the puzzle
    });

    // 返回生成的谜题
    return to_base64(puzzleS);
}

/**
 * 在客户端解密时间锁谜题（Proof of Work Puzzle）。
 * 所有的客户端计算需要跑在WebWorker中，避免阻塞主线程。
 * 解密所需的计算量和时间取决于服务器生成谜题时的难度级别。
 * NOTE: 这个函数仅运行在客户端。
 * @param puzzle
 * @param callback  可选的回调函数，用于在解密过程中提供进度反馈。
 */
export async function solvePoWPuzzle(
    puzzle: string,
    callback?: (p: number) => any | Promise<any>,
): Promise<string> {
    await ready;

    // 解密谜题
    const puzzleS = from_base64(puzzle);
    const result = await Puzzle.solve(puzzleS, callback);

    // 返回解密后的消息
    return result;
}

