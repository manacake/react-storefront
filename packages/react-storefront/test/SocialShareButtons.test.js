/**
 * @license
 * Copyright © 2017-2018 Moov Corporation.  All rights reserved.
 */
import Provider from './TestProvider'
import React from 'react'
import { mount } from 'enzyme'
import {
  FacebookShareButton,
  PinterestShareButton,
  TwitterShareButton
} from '../src/SocialShareButtons'

describe('SocialShareButtons', () => {
  const pathname = '/long/path'
  const search = '?param1=searchParam'
  const hostname = 'www.example.com'
  const app = {
    location: {
      pathname,
      search,
      hostname
    }
  }

  it('uses the right URL for Facebook sharing', () => {
    const wrapper = mount(
      <Provider app={app}>
        <FacebookShareButton />
      </Provider>
    )
    expect(wrapper.find('a').prop('href')).toContain(`u=https://${hostname}${pathname}${search}`)
  })

  it('uses the right URL for Twitter sharing', () => {
    const wrapper = mount(
      <Provider app={app}>
        <TwitterShareButton />
      </Provider>
    )
    expect(wrapper.find('a').prop('href')).toContain(`url=https://${hostname}${pathname}${search}`)
  })

  it('uses the right URL for Pinterest sharing', () => {
    const wrapper = mount(
      <Provider app={app}>
        <PinterestShareButton />
      </Provider>
    )
    expect(wrapper.find('a').prop('href')).toContain(`url=https://${hostname}${pathname}${search}`)
  })
})
