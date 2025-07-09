import {generatePoWPuzzle, solvePoWPuzzle} from "../src/crypto-puzzle/TimeLockPuzzle";

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testPoWPuzzle() {
    const data = 'Hello, this is a test message!';

    const difficulty = 5; // 选择难度级别

    console.log('🔐 开始生成时间锁谜题...');
    console.log(`📝 原始数据: ${data}`);
    console.log(`⚡ 难度级别: ${difficulty}`);

    const puzzle = await generatePoWPuzzle(data, difficulty);
    console.log('✅ 谜题生成完成！');
    console.log('🧩 Generated Puzzle:', JSON.stringify(puzzle, null, 2));

    console.log('\n🔍 开始解决谜题...');
    const t1 = Date.now();
    const solvedMessage = await solvePoWPuzzle(puzzle,
        async (progress: number) => {
            console.log(`🔄 解密进度: ${progress}%`);
            await sleep(0); // 让出事件循环，避免阻塞
        }
    );
    const t2 = Date.now();
    console.log(`⏱️ 谜题解决耗时: ${t2 - t1} ms`);

    console.log(`🎯 解决结果: ${solvedMessage}`);

    if (solvedMessage === data) {
        if (typeof window !== 'undefined' && (window as any).logSuccess) {
            (window as any).logSuccess('🎉 谜题解决成功！数据完全匹配！');
        } else {
            console.log('🎉 谜题解决成功！数据完全匹配！');
        }
    } else {
        console.error('❌ 谜题解决失败！数据不匹配！');
    }
}

// 为浏览器环境添加全局函数
if (typeof window !== 'undefined') {
    (window as any).testPoWPuzzle = testPoWPuzzle;
    // 页面加载后自动执行测试
    window.addEventListener('load', () => {
        setTimeout(() => {
            testPoWPuzzle().catch(console.error);
        }, 1000);
    });

} else {
    // Node.js环境
    testPoWPuzzle().catch(console.error);

    // // 测试生成速度
    // const startTime = Date.now();
    // const iterations = 1000; // 测试迭代次数
    // const promises = Array.from({ length: iterations }, () => generatePoWPuzzle('Test data', 20));
    // Promise.all(promises)
    //     .then(() => {
    //         const endTime = Date.now();
    //         console.log(`✅ ${iterations} 次生成时间锁谜题耗时: ${endTime - startTime} ms`);
    //         console.log(`平均每次生成耗时: ${(endTime - startTime) / iterations} ms`);
    //     })
    //     .catch(console.error);
}
