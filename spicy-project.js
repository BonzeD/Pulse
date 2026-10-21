'use strict';
// Project credential supplied by Pulse's author. Never send it to the renderer.
const PROJECT_KEY = 'sl_sk_viNoTe2UF5a6jnX55beLAAYG9cUk_xn1aWN7jzz3Las';
async function requestLyrics(id, { signal, fetchImpl = globalThis.fetch } = {}) {
  if (!/^[A-Za-z0-9]{22}$/.test(String(id))) throw Error('Invalid Spicy track ID');
  return fetchImpl(`https://api.spicylyrics.org/v1/lyrics/${id}`, {
    headers: { Authorization: `Bearer ${PROJECT_KEY}`, Accept: 'application/json', 'User-Agent': 'Pulse/1.0.0' },
    signal, redirect: 'error'
  });
}
module.exports = { requestLyrics };
