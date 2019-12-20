/**
 * @license
 * Copyright © 2017-2019 Moov Corporation.  All rights reserved.
 */
import cheerio from 'cheerio'
import { createOptimizedSrc } from '../imageService'

/**
 * Transforms image source to point to the Moovweb image optimizer.
 * @param {String} src
 * @param {Object} options
 * @param {Number} options.height The max height of the image when served to phones
 * @param {Number} options.width The max width of the image when served to phones
 * @param {Number} options.quality A number from 1-100 representing the amount to downscale the source image when served to phones
 * @param {Object} options.format "jpeg" or "webp" If webp is specified, webp will only be served to browsers that support it.
 * @return {String}
 */
function transformSource(src, options = { quality: 75 }) {
  return createOptimizedSrc(src, options)
}

/**
 * Transforms images within the given HTML to come from the Moovweb Image Optimizer
 * @param {String} html        Input HTML
 * @param {Object} options     Transformation options
 * @returns {String}           Optimized HTML
 */
export default function optimizeImages(html, options) {
  const $ = cheerio.load(html)

  $('img').each(function() {
    const $img = $(this)
    $img.attr('src', transformSource($img.attr('src'), options))
  })

  return $.html({ decodeEntities: false })
}
