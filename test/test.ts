import '../src/CustomCap';

// test
import {generatePoWPuzzle} from "../src/crypto-puzzle/TimeLockPuzzle";

async function initTestChallenge() {
    const data = 'testChallenge';
    (window as any).testChallenge = {
        data: data,
        challenge: await generatePoWPuzzle(data, 2),
    };
}

(window as any).initTestChallenge = initTestChallenge;
