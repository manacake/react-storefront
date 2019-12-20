import {
  createOptimizedSrc,
  configureImageService,
  XDN_IMAGE_SERVICE,
  resetImageService
} from '../src/imageService'

describe('imageService', () => {
  describe('configureImageService', () => {
    afterEach(() => {
      resetImageService()
    })

    it('should use the legacy service by default', () => {
      expect(
        createOptimizedSrc('https://image.com/foo.png', {
          width: 100
        })
      ).toBe('https://opt.moovweb.net/img?width=100&img=https%3A%2F%2Fimage.com%2Ffoo.png')
    })

    it('should default version to 1', () => {
      configureImageService(XDN_IMAGE_SERVICE)
      expect(createOptimizedSrc('https://image.com/foo.png', { width: 100 })).toBe(
        'https://optimize.moovweb.net/v1/img?width=100&img=https%3A%2F%2Fimage.com%2Ffoo.png'
      )
    })

    it('should accept a version option', () => {
      configureImageService(XDN_IMAGE_SERVICE, { version: '2' })
      expect(createOptimizedSrc('https://image.com/foo.png', { width: 100 })).toBe(
        'https://optimize.moovweb.net/v2/img?width=100&img=https%3A%2F%2Fimage.com%2Ffoo.png'
      )
    })
  })

  describe('createOptimizedSrc', () => {
    it('should return the original src when no options are provided', () => {
      expect(createOptimizedSrc('https://image.com/foo.png')).toBe('https://image.com/foo.png')
    })
  })
})
