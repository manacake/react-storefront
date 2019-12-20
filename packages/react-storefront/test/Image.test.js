/**
 * @license
 * Copyright © 2017-2018 Moov Corporation.  All rights reserved.
 */
import React from 'react'
import { mount } from 'enzyme'
import Image from '../src/Image'
import { Provider } from 'mobx-react'
import AppModelBase from '../src/model/AppModelBase'
import { configureImageService, XDN_IMAGE_SERVICE, LEGACY_IMAGE_SERVICE } from '../src/imageService'

describe('Image', () => {
  it('should render', () => {
    expect(
      mount(
        <Provider app={AppModelBase.create({ amp: false })}>
          <Image src="/foo.png" />
        </Provider>
      )
    ).toMatchSnapshot()
  })

  it('should use amp-img when rendering with amp: true', () => {
    expect(
      mount(
        <Provider app={AppModelBase.create({ amp: true })}>
          <Image src="/foo.png" />
        </Provider>
      )
    ).toMatchSnapshot()
  })

  it('should use height and width for amp-img when provided', () => {
    const wrapper = mount(
      <Provider app={AppModelBase.create({ amp: true })}>
        <Image src="/foo.png" height={50} width={100} />
      </Provider>
    )

    const ampImg = wrapper.find('amp-img')
    expect(ampImg.prop('height')).toBe(50)
    expect(ampImg.prop('width')).toBe(100)
    expect(ampImg.prop('layout')).toBe('intrinsic')
  })

  it('should use layout=fill for amp-img when aspectRatio is provided', () => {
    const wrapper = mount(
      <Provider app={AppModelBase.create({ amp: true })}>
        <Image src="/foo.png" aspectRatio={50} />
      </Provider>
    )

    const ampImg = wrapper.find('amp-img')
    expect(ampImg.prop('layout')).toBe('fill')
  })

  it('should lazy load the image when lazy==true', () => {
    const wrapper = mount(
      <Provider app={AppModelBase.create({ amp: false })}>
        <Image lazy src="/foo.png" aspectRatio={50} lazyOffset={-10000} />
      </Provider>
    )

    expect(wrapper).toMatchSnapshot()
  })

  it('should use the image optimizer when quality is set', () => {
    const wrapper = mount(
      <Provider app={AppModelBase.create({ amp: false })}>
        <Image quality={50} src="/foo.png" aspectRatio={50} />
      </Provider>
    )

    expect(wrapper).toMatchSnapshot()
  })

  it('should use the image optimizer when optimize is set', () => {
    const wrapper = mount(
      <Provider app={AppModelBase.create({ amp: false })}>
        <Image optimize={{ width: 300 }} src="/foo.png" />
      </Provider>
    )

    const img = wrapper.find('img')
    expect(img.prop('src')).toBe('https://opt.moovweb.net/img?width=300&img=%2Ffoo.png')
  })

  it('should use the not found image when the primary src fails', done => {
    const wrapper = mount(
      <Provider app={AppModelBase.create({ amp: false })}>
        <Image src="/foo.png" aspectRatio={50} notFoundSrc="/bar.png" />
      </Provider>
    )

    const image = wrapper.find('Image')

    image.setState({ primaryNotFound: true }, () => {
      const img = wrapper.find('img')
      expect(img.prop('src')).toBe('/bar.png')
      done()
    })
  })

  it('should leave the original src in place when notFoundSrc is not defined', done => {
    const wrapper = mount(
      <Provider app={AppModelBase.create({ amp: false })}>
        <Image src="/foo.png" aspectRatio={50} />
      </Provider>
    )
    const image = wrapper.find('Image')

    image.setState({ primaryNotFound: true }, () => {
      const img = wrapper.find('img')
      expect(img.prop('src')).toBe('/foo.png')
      done()
    })
  })

  describe('imageService/configureImageService', () => {
    beforeEach(() => {
      configureImageService(XDN_IMAGE_SERVICE, { version: '2' })
    })

    afterEach(() => {
      configureImageService(LEGACY_IMAGE_SERVICE)
    })

    it('should use the configured image service', () => {
      const wrapper = mount(
        <Provider app={AppModelBase.create({ amp: false })}>
          <Image src="https://images.com/foo.png" aspectRatio={50} optimize={{ width: 100 }} />
        </Provider>
      )
      expect(wrapper.find('img').prop('src')).toBe(
        'https://optimize.moovweb.net/v2/img?width=100&img=https%3A%2F%2Fimages.com%2Ffoo.png'
      )
    })
  })
})
