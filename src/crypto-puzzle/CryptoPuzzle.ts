
/* IMPORT */

import fme from 'fast-mod-exp';
// import Encryptor from 'tiny-encryptor';
import getPrime from 'crypto-random-prime';
import getInRange from 'crypto-random-in-range';
// import getRandomBytes from 'crypto-random-uint8';
// import {sha256} from 'crypto-sha';
// import U8 from 'uint8-encoding';
import BigEnc from 'bigint-encoding';
import Archiver from './archiver';
import {sfme} from './utils';
import type {Options} from './types';
import {
  ready,
  crypto_secretbox_keygen,
  crypto_secretbox_easy,
  crypto_secretbox_open_easy,
  crypto_secretbox_NONCEBYTES,
  crypto_secretbox_KEYBYTES,
  randombytes_buf,
  crypto_generichash,
} from 'libsodium-wrappers';

/* MAIN */

//URL: https://people.csail.mit.edu/rivest/pubs/RSW96.pdf

const CryptoPuzzle = {

  /* API */

  generate: async ( options: Options ): Promise<Uint8Array> => {

    await ready;

    const PRIME_BITS = options.primeBits ?? 100;
    const PRIME_ROUNDS = options.primeRounds ?? 20;
    const OPS_PER_SECOND = options.opsPerSecond ?? 3_300_000;
    const DURATION = options.duration ?? 1_000;
    const MESSAGE = options.message;

    const p = getPrime ( PRIME_BITS, PRIME_ROUNDS );
    const q = getPrime ( PRIME_BITS, PRIME_ROUNDS );

    const n = p * q;
    const n1 = ( p - 1n ) * ( q - 1n );

    const S = OPS_PER_SECOND;
    const T = DURATION;
    const t = BigInt ( Math.round ( Math.max ( 1, ( S / 1000 ) ) * T ) );

    // const K = crypto_generichash ( crypto_secretbox_KEYBYTES, randombytes_buf ( 32, 'uint8array' ), null, 'uint8array' );
    const K = crypto_secretbox_keygen ( );
    const M = MESSAGE;
    const nonce = randombytes_buf ( crypto_secretbox_NONCEBYTES );
    const Cm = crypto_secretbox_easy ( M, nonce, K );

    const a = getInRange ( 1n, n - 1n );
    const e = fme ( 2n, t, n1 );
    const b = fme ( a, e, n );
    const Ck = BigEnc.encode ( K ) + b;

    const archive = Archiver.archive ([ n, a, t, Ck, Cm, nonce ]);

    return archive;

  },

  solve: async ( puzzle: Uint8Array, callback?: (p: number) => any | Promise<any>  ): Promise<string> => {

    await ready;

    const [n, a, t, Ck, Cm, nonce ] = Archiver.unarchive ( puzzle );

    const b = await sfme ( a, t, n, callback );
    const K = BigEnc.decode ( Ck - b );
    // const M_uint8 = crypto_secretbox_open_easy ( Cm, nonce, K, 'uint8array' );
    // const M = U8.decode ( M_uint8 );
    const M = crypto_secretbox_open_easy ( Cm, nonce, K, 'text' );

    return M;

  }

};

/* EXPORT */

export default CryptoPuzzle;
export type {Options};
