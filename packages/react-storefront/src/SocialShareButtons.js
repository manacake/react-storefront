/**
 * @license
 * Copyright © 2017-2018 Moov Corporation.  All rights reserved.
 */
import React from 'react'
import withStyles from '@material-ui/core/styles/withStyles'
import classnames from 'classnames'
import { inject } from 'mobx-react'

/**
 * @ignore - do not document.
 */

export const styles = theme => ({
  link: {
    display: 'inline-block',
    textDecoration: 'none',
    color: '#fff',
    margin: '0.3em',
    backgroundColor: 'transparent'
  },
  button: {
    fontSize: '1em',
    borderRadius: '5px',
    transition: '25ms ease-out',
    padding: '0.3em 0.3em',
    fontFamily: 'Helvetica Neue,Helvetica,Arial,sans-serif'
  },
  facebookButton: {
    backgroundColor: '#3b5998',
    '&:hover': {
      backgroundColor: '#2d4373'
    }
  },
  twitterButton: {
    backgroundColor: '#55acee',
    '&:hover': {
      backgroundColor: '#2795e9'
    }
  },
  googleButton: {
    backgroundColor: '#dd4b39',
    '&:hover': {
      backgroundColor: '#c23321'
    }
  },
  pinterestButton: {
    backgroundColor: '#bd081c',
    '&:hover': {
      backgroundColor: '#8c0615'
    }
  },
  icon: {
    fill: '#fff',
    stroke: 'none',
    strokeWidth: '2px',
    display: 'inline-block'
  },
  svg: {
    height: '1.2em',
    width: '1.2em',
    verticalAlign: 'top',
    margin: '0'
  }
})

@withStyles(styles, { name: 'RSFSocialShareButton' })
class SocialShareButton extends React.Component {
  render() {
    const { classes, href, path, name } = this.props
    return (
      <a className={classes.link} href={href} target="_blank">
        <div className={classnames(classes.button, classes[`${name}Button`])}>
          <div aria-hidden="true" className={classnames(classes.icon, classes[`${name}Icon`])}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className={classnames(classes.svg, classes[`${name}Svg`])}
            >
              <path d={path} />
            </svg>
          </div>
        </div>
      </a>
    )
  }
}

/**
 * Facebook Sharing Component. Pulls information from the page and open graph tags.
 *
 * Usage:
 *
 *  <FacebookShareButton />
 *
 */
export const FacebookShareButton = inject('app')(({ app }) => {
  return (
    <SocialShareButton
      name="facebook"
      href={`https://facebook.com/sharer/sharer.php?u=${encodeURI(app.location.href)}`}
      path="M18.77 7.46H14.5v-1.9c0-.9.6-1.1 1-1.1h3V.5h-4.33C10.24.5 9.5 3.44 9.5 5.32v2.15h-3v4h3v12h5v-12h3.85l.42-4z"
    />
  )
})

/**
 * Twitter Sharing Component. Uses given text parameter.
 *
 * Usage:
 *
 *  <TwitterShareButton text="This is a test" />
 *
 */
export const TwitterShareButton = inject('app')(({ app, text }) => {
  return (
    <SocialShareButton
      name="twitter"
      href={`https://twitter.com/intent/tweet/?text=${encodeURIComponent(text)};url=${encodeURI(
        app.location.href
      )}`}
      path="M23.44 4.83c-.8.37-1.5.38-2.22.02.93-.56.98-.96 1.32-2.02-.88.52-1.86.9-2.9 1.1-.82-.88-2-1.43-3.3-1.43-2.5 0-4.55 2.04-4.55 4.54 0 .36.03.7.1 1.04-3.77-.2-7.12-2-9.36-4.75-.4.67-.6 1.45-.6 2.3 0 1.56.8 2.95 2 3.77-.74-.03-1.44-.23-2.05-.57v.06c0 2.2 1.56 4.03 3.64 4.44-.67.2-1.37.2-2.06.08.58 1.8 2.26 3.12 4.25 3.16C5.78 18.1 3.37 18.74 1 18.46c2 1.3 4.4 2.04 6.97 2.04 8.35 0 12.92-6.92 12.92-12.93 0-.2 0-.4-.02-.6.9-.63 1.96-1.22 2.56-2.14z"
    />
  )
})

/**
 * Pinterest Sharing Component. Uses given parameters.
 *
 * Usage:
 *
 *  <PinterestShareButton description="This is a test" media="http://test.com/test.jpg" />
 *
 */
export const PinterestShareButton = inject('app')(({ app, media, description }) => {
  return (
    <SocialShareButton
      name="pinterest"
      href={`https://pinterest.com/pin/create/button/?url=${encodeURI(
        app.location.href
      )};media=${media};description=${encodeURIComponent(description)}`}
      path="M12.14.5C5.86.5 2.7 5 2.7 8.75c0 2.27.86 4.3 2.7 5.05.3.12.57 0 .66-.33l.27-1.06c.1-.32.06-.44-.2-.73-.52-.62-.86-1.44-.86-2.6 0-3.33 2.5-6.32 6.5-6.32 3.55 0 5.5 2.17 5.5 5.07 0 3.8-1.7 7.02-4.2 7.02-1.37 0-2.4-1.14-2.07-2.54.4-1.68 1.16-3.48 1.16-4.7 0-1.07-.58-1.98-1.78-1.98-1.4 0-2.55 1.47-2.55 3.42 0 1.25.43 2.1.43 2.1l-1.7 7.2c-.5 2.13-.08 4.75-.04 5 .02.17.22.2.3.1.14-.18 1.82-2.26 2.4-4.33.16-.58.93-3.63.93-3.63.45.88 1.8 1.65 3.22 1.65 4.25 0 7.13-3.87 7.13-9.05C20.5 4.15 17.18.5 12.14.5z"
    />
  )
})
