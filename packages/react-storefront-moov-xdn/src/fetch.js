/**
 * @license
 * Copyright © 2017-2018 Moov Corporation.  All rights reserved.
 */
import isString from 'lodash/isString'
import merge from 'lodash/merge'
import URL from 'url'
import qs from 'qs'
import pako from 'pako'
import Headers from './Headers'

function isFormUrlEncoded(contentType) {
  return contentType && contentType.indexOf('x-www-form-urlencoded') >= 0
}

/**
 * Creates options for a fetch call
 * @param {String} url The URL to fetch
 * @param {Object} fetchOptions fetch options
 * @param {String} qsOptions Options for serializing the request body using the qs package
 */
function createRequestOptions(url, fetchOptions, qsOptions) {
  let { body, headers = {}, method, ...options } = fetchOptions

  forwardHeadersFromBrowser(headers)

  if (body) {
    method = method || 'POST'

    // Only apply stringifying when body is not a string already
    if (!isString(body)) {
      if (isFormUrlEncoded(headers['content-type'])) {
        body = qs.stringify(body, qsOptions)
      } else {
        body = JSON.stringify(body)
        headers['content-type'] = 'application/json'
      }
    }

    headers['content-length'] = Buffer.byteLength(body)
  }

  const { hostname, port, path } = URL.parse(url)

  return {
    ...options,
    method,
    body,
    hostname,
    port,
    path,
    headers
  }
}

const FORWARD_HEADERS = [
  // Apply user-agent header from the browser if one isn't explicitly set
  // This helps prevent synthetic APIs from getting blocked.
  'user-agent',
  // This is needed when using basic auth for both the PWA and the site used
  // for the synthetic API.
  'authorization',
  // Needed for keeping sessions alive, some sites rely on this to
  // be constant during a session
  'x-forwarded-for'
]

/**
 * Copies certain headers from the browser request to the provided headers if they are not already present.
 * See FORWARD_HEADERS.
 * @private
 * @param {Object} userHeaders The headers passed to fetch by the developer
 */
function forwardHeadersFromBrowser(userHeaders) {
  for (let header of FORWARD_HEADERS) {
    if (
      !Object.keys(userHeaders).find(name => name.toLowerCase() === header) &&
      global.env.rsf_request &&
      global.env.rsf_request.headers
    ) {
      const value = global.env.rsf_request.headers.get(header)

      if (value != null) {
        userHeaders[header] = value
      }
    }
  }
}

/**
 * The same as fetch, but automatically relays the cookies passed in from the browser to the upstream API.
 * @param {String} url The url to fetch
 * @param {Object} options Options for fetch
 * @param {Object} [options.redirect=manual] "manual", "follow", or "error"
 * @param {Object} [options.maxRedirects=20] The maximum number of redirects that fetch will follow before returning an error.  Defaults to 20.
 * @param {Object} [options.acceptInvalidCerts=false] Set to true to allow connections to sites with invalid SSL cers.
 * @param {String} qsOptions Options for serializing the request body using the qs package
 * @return {Promise}
 */
export function fetchWithCookies(url, options = {}, qsOptions) {
  const headers = {}

  if (env.cookie) {
    if (Array.isArray(env.shouldSendCookies)) {
      // send only those cookies that are included in the custom cache key (see router/cache.js)
      headers.cookie = pickCookies(env.rsf_request.cookies, env.shouldSendCookies)
    } else if (env.shouldSendCookies !== false) {
      // will get here when the response is cached at edge without a custom cache key
      headers.cookie = env.cookie
    }
  }

  return fetch(
    url,
    merge(options, {
      credentials: 'include',
      headers
    }),
    qsOptions
  )
}

/**
 * Returns a cookie header containing only those cookies in `names` copied over
 * from the incoming request from the browser
 * @param {Object} fromCookies The source cookies
 * @param {String[]} names
 * @return {String}
 */
function pickCookies(fromCookies, names) {
  const cookies = []

  for (let name of names) {
    const value = fromCookies[name]

    if (value !== undefined) {
      cookies.push(`${name}=${fromCookies[name]}`)
    }
  }

  return cookies.join('; ')
}

/**
 * An implementation of the standard fetch API.  See https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API for options
 *
 * This function is commonly used to fetch json data
 *
 * ```js
 * const data = await fetch('https://jsonplaceholder.typicode.com/todos/1')
 *   .then(res => res.json())
 * ```
 *
 * Or string data:
 *
 * ```js
 * const text = await fetch('https://jsonplaceholder.typicode.com/todos/1')
 *   .then(res => res.text())
 * ```
 *
 * You can also use it to fetch binary data:
 *
 * ```js
 * const buffer = await fetch('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf')
 *   .then(res => res.arrayBuffer())
 * ```
 *
 * @param {String} url The URL to fetch
 * @param {Object} options Options for fetch. In addition to the standard fetch options, you can also specify:
 * @param {Object} [options.redirect=manual] "manual", "follow", or "error"
 * @param {Object} [options.maxRedirects=20] The maximum number of redirects that fetch will follow before returning an error.  Defaults to 20.
 * @param {Object} [options.acceptInvalidCerts=false] Set to true to allow connections to sites with invalid SSL cers.
 * @param {Object} qsOptions Options for serializing the request body using the qs package
 * @return {Promise}
 */
export default function fetch(url, options = {}, qsOptions) {
  return new Promise((resolve, reject) => {
    const protocol = url.match(/^https/) ? global.https : global.http
    const { body, ...requestOptions } = createRequestOptions(url, options, qsOptions)

    // use native node buffer, not webpack's shim, so it can be passed with response.send() on Moov XDN
    const Buffer = global.Buffer

    // Moov should inject this via the Server component
    const req = protocol.request(requestOptions, response => {
      let data = []

      relaySetCookies(response, requestOptions.hostname)

      response.on('data', chunk => data.push(chunk))

      response.on('end', () => {
        data = Buffer.concat(data)

        if ([301, 302].includes(response.statusCode) && response.headers.location) {
          // redirects
          const { maxRedirects = 20 } = options

          if (options.redirect === 'follow') {
            if (maxRedirects > 0) {
              const redirectURL = URL.resolve(url, response.headers.location)
              return resolve(
                fetch(redirectURL, { ...options, maxRedirects: maxRedirects - 1, redirected: true })
              )
            } else {
              return reject(
                new Error('The maximum number of redirects has been reached while using fetch.')
              )
            }
          } else if (options.redirect === 'error') {
            return reject(
              new Error(
                `fetch received a redirect response status ${response.statusCode} and options.redirect was set to "error".`
              )
            )
          } else {
            const redirectData = { redirect: response.headers.location }

            return resolve({
              redirected: true,
              url: response.headers.location,
              status: response.statusCode,
              ok: true,
              headers: response.headers,
              text: () => Promise.resolve(JSON.stringify(redirectData)),
              json: () => Promise.resolve(redirectData)
            })
          }
        } else {
          // all other success and error response codes
          const ok = response.statusCode >= 200 && response.statusCode <= 299

          const result = {
            redirected: options.redirected || false,
            url,
            status: response.statusCode,
            statusText: response.statusText,
            ok,
            headers: new Headers(response.headers),
            requestHeaders: () => new Headers(requestOptions.headers),
            arrayBuffer: () => Promise.resolve(data),
            text: () => Promise.resolve(extractString(response, data)),
            json: () => Promise.resolve(JSON.parse(extractString(response, data))),
            clone: () => ({ ...result })
          }

          if (!ok) {
            const error = new Error(`${response.statusCode}: ${data.toString('utf8')}`)
            error.response = result
            reject(error)
            return
          }

          // Recreating simple API similar to Fetch
          // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
          resolve(result)
        }
      })
    })

    req.on('error', err => {
      reject(err)
    })

    // do not break request when we have no data
    if (body) {
      req.write(body)
    }

    req.end()
  })
}

function extractString(response, data) {
  if (response.headers['content-encoding'] === 'gzip') {
    return pako.inflate(data, { to: 'string' })
  } else {
    return data.toString('utf8')
  }
}

/**
 * Adds a set-cookie header to env.MUR_SET_COOKIES so we can relay it to the browser in Response.send
 * This is the mechanism by which we propagate sessions created in MUR requests.
 * @param {Object} request The request object
 * @param {String} domain The request hostname
 */
function relaySetCookies(request, domain) {
  const cookie = request.headers['set-cookie']

  if (cookie) {
    const cookies = env.MUR_SET_COOKIES || {}
    cookies[domain] = (cookies[domain] || []).concat(cookie)
    fns.export('MUR_SET_COOKIES', cookies)
  }
}
