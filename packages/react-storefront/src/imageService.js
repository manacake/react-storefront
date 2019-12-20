/**
 * @license
 * Copyright © 2017-2019 Moov Corporation.  All rights reserved.
 */
import qs from 'qs'

/**
 * The old image optimizer intented for mobile phones only
 */
export const LEGACY_IMAGE_SERVICE = 'https://opt.moovweb.net'

/**
 * The new image optimizer which supports all device types.
 */
export const XDN_IMAGE_SERVICE = 'https://optimize.moovweb.net'

/**
 * The new image optimizer running on localhost:8090
 */
export const LOCAL_IMAGE_SERVICE = 'http://localhost:8090'

let optimizerUrlBase = LEGACY_IMAGE_SERVICE

/**
 * Changes the base URL for the Moovweb image service.
 * @param {String} url Use `LEGACY_IMAGE_OPTIMIZER` or `RESPONSIVE_IMAGE_OPTIMIZER`.
 * @param {Object} options
 * @param {Object} options.version The version of the image optimizer API to use. Defaults to '1'
 */
export function configureImageService(url, { version = '1' } = {}) {
  optimizerUrlBase = url

  if (url === XDN_IMAGE_SERVICE) {
    optimizerUrlBase += `/v${version}`
  }
}

/**
 * Resets the image service to the default implementation
 */
export function resetImageService() {
  optimizerUrlBase = LEGACY_IMAGE_SERVICE
}

/**
 * Creates an optimized image URL
 * @param {String} src
 * @param {Object} options
 * @param {Number} options.height The max height of the image when served to phones
 * @param {Number} options.width The max width of the image when served to phones
 * @param {Number} options.quality A number from 1-100 representing the amount to downscale the source image when served to phones
 * @param {Object} options.format "jpeg" or "webp" If webp is specified, webp will only be served to browsers that support it.
 * @return {String}
 */
export function createOptimizedSrc(src, options = {}) {
  // The legacy service used fmt, so we kept it for the new responsive service,
  // but we use "format" here because non of the other options are abbreviated
  if (options.format) options.fmt = options.format

  if (Object.keys(options).length > 0) {
    return `${optimizerUrlBase}/img?${qs.stringify({ ...options, img: src })}`
  } else {
    return src
  }
}
