
/* MAIN */

const sfme = async ( a: bigint, t: bigint, n: bigint , callback?: (p: number) => any | Promise<any> ): Promise<bigint> => {

  let x = a % n;

  const cf = !!callback;

  if ( t <= BigInt ( Number.MAX_SAFE_INTEGER ) ) {

    const pn1 = Number ( t ) / 100;

    let px = 0;

    let pn = 0;

    for ( let i = Number ( t ); i > 0; i-- ) {

      x = ( x * x ) % n;

      if (cf) {
        if (pn < pn1) {
          ++pn;
        } else {
          ++px;
          pn = 0;
          await callback(px);
        }
      }

    }

  } else {

    const pn1 = t / 100n;

    let px = 0;

    let pn = 0n;

    for ( let i = t; i > 0n; i-- ) {

      x = ( x * x ) % n;

      if (cf) {
        if (pn < pn1) {
          ++pn;
        } else {
          ++px;
          pn = 0n;
          await callback(px);
        }
      }

    }

  }

  return x % n;

};

/* EXPORT */

export {sfme};
