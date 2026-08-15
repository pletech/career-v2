/**
 * 全経路にかかる Basic 認証 (Cloudflare Pages Functions)。
 *
 * 社内向けのツールなので「社外の人がURLを踏んでも入れない」ところまでを担う。
 * **共通アカウント1つ**で、個人別のログインではない (HANDOFF §4c-0)。
 * チェックの中身は各自の localStorage にしか無いので、ここで守るのは
 * 「社外の人が道具として使えてしまうこと」であって、データの秘匿ではない。
 *
 * ⚠️ **リポジトリが public なので `public/data/*.csv` は GitHub からそのまま読める。**
 * この門はそこまでは塞がない。塞ぐならリポジトリを private にする判断が要る。
 *
 * 設定 (Cloudflare の環境変数。**リポジトリにも文書にも値を書かない** — HANDOFF §5):
 *   GATE_PASSWORD … 必須。合言葉
 *   GATE_USER     … 任意。未設定なら "pletech"
 */

interface Env {
  GATE_USER?: string;
  GATE_PASSWORD?: string;
}

interface RequestContext {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
}

const REALM = 'PLETECH Career Path';
const DEFAULT_USER = 'pletech';

export const onRequest = async (context: RequestContext): Promise<Response> => {
  const expectedPassword = context.env.GATE_PASSWORD;

  /**
   * secret 未設定なら**通さない**。
   * 「設定し忘れて丸見えのまま公開されていた」が一番起きやすい事故なので、
   * 設定漏れは 503 で止める側に倒す (fail closed)。開ける側に倒すと気づけない。
   */
  if (!expectedPassword) {
    return text(503, 'この配信はまだ設定が終わっていません。(GATE_PASSWORD 未設定)');
  }

  const expectedUser = context.env.GATE_USER || DEFAULT_USER;
  const given = readBasicAuth(context.request);

  if (
    given !== null &&
    (await equals(given.user, expectedUser)) &&
    (await equals(given.password, expectedPassword))
  ) {
    return context.next();
  }

  return new Response('認証が必要です。', {
    status: 401,
    headers: {
      // charset="UTF-8" が無いと、日本語の合言葉を入れたときに端末ごとに化ける
      'www-authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
};

function text(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

/** `Authorization: Basic ...` を読む。形が違えば null (エラーにはしない — 401 を返せばいい) */
function readBasicAuth(request: Request): { user: string; password: string } | null {
  const header = request.headers.get('Authorization');
  if (header === null) return null;

  const separatorIndex = header.indexOf(' ');
  if (separatorIndex < 0) return null;
  if (header.slice(0, separatorIndex).toLowerCase() !== 'basic') return null;

  const encoded = header.slice(separatorIndex + 1).trim();
  if (encoded === '') return null;

  let decoded: string;
  try {
    // atob は latin1 で返すので、TextDecoder で UTF-8 に戻す。
    // これが無いと日本語・韓国語の合言葉が通らない。
    decoded = new TextDecoder().decode(
      Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)),
    );
  } catch {
    return null;
  }

  const colon = decoded.indexOf(':');
  if (colon < 0) return null;
  return { user: decoded.slice(0, colon), password: decoded.slice(colon + 1) };
}

/**
 * 突き合わせ。**先に SHA-256 を取ってから固定長で比べる。**
 * 素朴な `===` は一致した文字数だけ時間が延びるので、応答時間から合言葉を
 * 1文字ずつ削り出せてしまう。ハッシュにすれば長さも中身も漏れない。
 */
async function equals(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);

  const a = new Uint8Array(leftDigest);
  const b = new Uint8Array(rightDigest);
  let difference = a.length ^ b.length;
  for (let i = 0; i < a.length && i < b.length; i += 1) {
    difference |= a[i] ^ b[i];
  }
  return difference === 0;
}
