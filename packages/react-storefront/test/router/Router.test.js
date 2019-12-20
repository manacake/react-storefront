/**
 * @license
 * Copyright © 2017-2018 Moov Corporation.  All rights reserved.
 */
jest.mock('../../src/router/serviceWorker')

import {
  Router,
  fromClient,
  fromServer,
  fromOrigin,
  redirectTo,
  cache,
  proxyUpstream
} from '../../src/router'
import * as serviceWorker from '../../src/router/serviceWorker'
import { createMemoryHistory } from 'history'
import qs from 'qs'
import Response from '../../../react-storefront-moov-xdn/src/Response'
import createCustomCacheKey from '../../src/router/createCustomCacheKey'

describe('Router:Node', function() {
  let router, runAll, response
  const handler = params => Promise.resolve(params)

  beforeEach(function() {
    window.moov = {
      timing: {}
    }
    jest.spyOn(global.console, 'error').mockImplementation()
    process.env.MOOV_RUNTIME = 'server'
    router = new Router()
    global.headers = {
      header: Function.prototype
    }
    global.env = {
      host: 'localhost',
      headers: JSON.stringify({})
    }
    runAll = function(method, path) {
      global.env.path = path
      global.env.method = method

      const [pathname, search] = path.split(/\?/)
      const request = {
        path: pathname,
        pathname,
        query: qs.parse(search),
        search: search ? `?${search}` : '',
        method
      }
      jest.spyOn(console, 'warn').mockImplementation()
      const promise = router.runAll(request, (response = new Response()))

      if (promise) {
        return promise
      } else {
        throw new Error(`no route matched ${method} ${path}`)
      }
    }
  })

  afterEach(function() {
    delete process.env.MOOV_RUNTIME
    delete global.headers
  })

  describe('runAll', function() {
    it('should match based on method', async function() {
      router
        .get('/products', () => Promise.resolve({ method: 'get' }))
        .post('/products', () => Promise.resolve({ method: 'post' }))

      expect(await runAll('get', '/products')).toEqual({ method: 'get' })
      expect(await runAll('post', '/products')).toEqual({ method: 'post' })
    })

    it('should support GET', async () => {
      router.get('/', fromClient({ foo: 'bar' }))
      expect(await runAll('get', '/')).toEqual({ foo: 'bar' })
    })

    it('should support POST', async () => {
      router.post('/', fromClient({ foo: 'bar' }))
      expect(await runAll('post', '/')).toEqual({ foo: 'bar' })
    })

    it('should support PATCH', async () => {
      router.patch('/', fromClient({ foo: 'bar' }))
      expect(await runAll('patch', '/')).toEqual({ foo: 'bar' })
    })

    it('should support PUT', async () => {
      router.put('/', fromClient({ foo: 'bar' }))
      expect(await runAll('put', '/')).toEqual({ foo: 'bar' })
    })

    it('should support options', async () => {
      router.options('/', fromClient({ foo: 'bar' }))
      expect(await runAll('options', '/')).toEqual({ foo: 'bar' })
    })

    it('should support DELETE', async () => {
      router.delete('/', fromClient({ foo: 'bar' }))
      expect(await runAll('delete', '/')).toEqual({ foo: 'bar' })
    })

    it('should parse query params', async () => {
      router.get('/foo', params => params)
      expect(await runAll('get', '/foo?x=1&y=2')).toEqual({ x: '1', y: '2' })
    })

    it('should support splat', async function() {
      router.get('/products/:id(/*seoText)', handler)
      expect(await runAll('get', '/products/1/foo')).toEqual({ id: '1', seoText: 'foo' })
      expect(await runAll('get', '/products/1')).toEqual({ id: '1', seoText: undefined })
    })

    it('should support optional paths', async function() {
      router.get('/products/:id(/foo)', handler)
      expect(await runAll('get', '/products/1/foo')).toEqual({ id: '1' })
      expect(await runAll('get', '/products/1')).toEqual({ id: '1' })
    })

    it('should support optional params', async function() {
      router.get('/products/:id(/:foo)', handler)
      expect(await runAll('get', '/products/1/2')).toEqual({ id: '1', foo: '2' })
      expect(await runAll('get', '/products/1')).toEqual({ id: '1', foo: undefined })
    })

    it('should match based on suffix', async function() {
      router.get('/users/:id.html', fromServer(() => Promise.resolve({ result: 'html' })))
      router.get('/users/:id.json', fromServer(() => Promise.resolve({ result: 'json' })))

      expect(await runAll('get', '/users/1.html')).toEqual({ result: 'html' })
      expect(await runAll('get', '/users/1.json')).toEqual({ result: 'json' })
    })

    it('should capture the suffix', async function() {
      router.get('/users/:id.:format', params => Promise.resolve(params))
      expect(await runAll('get', '/users/1.html')).toEqual({ id: '1', format: 'html' })
      expect(await runAll('get', '/users/1.json')).toEqual({ id: '1', format: 'json' })
    })

    it('should merge the result of multiple handlers', async function() {
      router.get(
        '/c/:id',
        fromClient({ view: 'category' }),
        fromServer(() => Promise.resolve({ name: 'test' })),
        fromServer(() => ({ url: '/c/1' }))
      )

      expect(await runAll('get', '/c/1')).toEqual({ view: 'category', name: 'test', url: '/c/1' })
    })

    it('should apply params to request', async () => {
      let requestParams

      router.get('/c/:id', fromServer((params, request) => (requestParams = request.params)))

      await runAll('get', '/c/1')
      expect(requestParams).toEqual({ id: '1' })
    })

    it('should not mutate the provided state', async () => {
      router.get('/', fromClient({ foo: 'xxx' }))

      const initialState = { foo: 'bar' }
      const request = { path: '/', search: '', method: 'get' }
      const result = await router.runAll(request, new Response(), {}, initialState)

      expect(result.foo).toEqual('xxx')
      expect(initialState.foo).toEqual('bar')
    })

    it('should skip client only handlers when running on the server', async () => {
      const handler = jest.fn()

      router.get('/', {
        runOn: {
          server: false
        },
        fn: handler
      })

      await runAll('get', '/')

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('run', function() {
    it('should run after handlers on fallback when afterOnly is true', async () => {
      let ran = false
      const response = new Response()

      router.fallback({
        runOn: {
          server: true,
          client: true,
          after: true
        },
        fn: () => {
          return true
        }
      })

      for await (let result of router.run({ path: '/', search: '' }, response)) {
        ran = result
      }

      expect(ran).toBe(true)
    })

    it('should yield the accumulated state from handlers that succeeded', async function() {
      const response = new Response()

      router
        .get(
          '/',
          fromClient({ view: 'home' }),
          fromServer(() => {
            throw new Error('test')
          })
        )
        .error((path, params, request, response) =>
          Promise.resolve({
            error: 'Error message'
          })
        )

      const results = []

      for await (let result of router.run({ path: '/', search: '' }, response)) {
        results.push(result)
      }

      expect(results[0]).toEqual({ view: 'home' })
      expect(results[1]).toEqual({ error: 'Error message' })
      expect(results.length).toEqual(2)
      expect(await router.runAll({ path: '/', search: '', method: 'GET' }, response)).toEqual({
        view: 'home',
        error: 'Error message'
      })
    })

    it('should yield loading: true when running on the client', async () => {
      const response = new Response()
      const results = []
      const historyState = { foo: 'bar' }
      process.env.MOOV_RUNTIME = 'client'

      const router = new Router().get('/', {
        runOn: {
          server: true
        },
        type: 'fromServer',
        fn: () => ({ page: 'Home' })
      })

      for await (let result of router.run({ path: '/', search: '' }, response, { historyState })) {
        results.push(result)
      }

      expect(results[0]).toEqual({
        loading: true,
        location: {
          pathname: '/',
          search: '',
          hostname: 'localhost',
          port: '',
          protocol: 'http'
        },
        foo: 'bar'
      })
    })
  })

  describe('handlers', function() {
    it('should run data requests on server side', async function() {
      router.get(
        '/products.json',
        fromServer(() =>
          Promise.resolve({
            products: [{ name: 'Dog Toy' }]
          })
        )
      )
      expect(await runAll('get', '/products.json')).toEqual({
        products: [{ name: 'Dog Toy' }]
      })
    })

    it('should not execute fromClient on data request', async function() {
      router.get('/c/:id.json', fromClient({ view: 'category' }))
      expect((await runAll('get', '/c/1.json')).view).not.toBeDefined()
    })

    it('should accept static data', async function() {
      router.get('/c/:id', fromClient({ view: 'category' }))

      expect(await runAll('get', '/c/1')).toEqual({ view: 'category' })
    })

    it('should accept static promises', async function() {
      router.get('/c/:id', fromClient(() => Promise.resolve({ view: 'category' })))

      expect(await runAll('get', '/c/1')).toEqual({ view: 'category' })
    })

    it('should run synchronous functions', async function() {
      router.get('/c/:id', fromClient(() => ({ view: 'category' })))

      expect(await runAll('get', '/c/1')).toEqual({ view: 'category' })
    })

    it('should handle errors on the client side with default error handler', async function() {
      router.get(
        '/test/:id',
        fromClient(() => {
          throw new Error('This is an error')
        })
      )
      const state = await runAll('get', '/test/123')
      expect(state.error).toEqual('This is an error')
      expect(state.stack).toBeDefined()
    })

    it('should handle errors on the client side with custom error handler', async function() {
      router
        .get(
          '/test/:q',
          fromClient(() => {
            throw new Error('This is an error')
          })
        )
        .error((e, params, request, response) => {
          return {
            q: params.q,
            message: e.message
          }
        })
      expect(await runAll('get', '/test/123')).toEqual({
        q: '123',
        message: 'This is an error'
      })
    })

    it('should handle errors on the server side with default error handler', async function() {
      router.get(
        '/test',
        fromServer(() => {
          throw new Error('This is an error on the server')
        })
      )
      const state = await runAll('get', '/test')
      expect(state.error).toEqual('This is an error on the server')
      expect(state.stack).toBeDefined()
      expect(state.loading).toBe(false)
      expect(state.page).toBe('Error')
    })

    it('should handle errors on the server side with custom error handler', async function() {
      router
        .get(
          '/test/:q',
          fromServer(() => {
            throw new Error('This is an error on the server')
          })
        )
        .error((e, params, request, response) => {
          return {
            q: params.q,
            message: e.message
          }
        })
      expect(await runAll('get', '/test/123')).toEqual({
        q: '123',
        message: 'This is an error on the server'
      })
    })

    it('should provide params in client handler', async function() {
      router.get(
        '/c/:id',
        fromClient(params => ({ view: 'category', id: params.id, query: params.q }))
      )
      expect(await runAll('get', '/c/1?q=hello')).toEqual({
        view: 'category',
        query: 'hello',
        id: '1'
      })
    })

    it('should handle simple 404', async function() {
      router.get('/test', fromClient(() => ({ view: 'test' })))

      expect(await runAll('get', '/hello')).toEqual({
        page: '404'
      })
    })

    it('should handle error in extended 404 properly', async function() {
      router.get('/test', fromClient(() => ({ view: 'test' }))).fallback(
        fromServer(() => {
          throw new Error('This is an error on the server')
        })
      )
      const state = await runAll('get', '/hello')
      expect(state.error).toEqual('This is an error on the server')
      expect(state.stack).toBeDefined()
    })

    it('should handle extended 404 rendering', async function() {
      router.get('/test', fromClient(() => ({ view: 'test' }))).fallback(
        fromClient({ view: '404' }),
        fromServer(() =>
          Promise.resolve({
            products: [{ name: 'Dog Toy' }, { name: 'Bone' }]
          })
        )
      )
      expect(await runAll('get', '/hello')).toEqual({
        view: '404',
        products: [{ name: 'Dog Toy' }, { name: 'Bone' }]
      })
    })

    it('should handle params with a period in them', async function() {
      router.get('/p/:id', params => Promise.resolve(params))
      expect(await runAll('get', '/p/hello.world')).toEqual({ id: 'hello.world' })
    })

    it('should pass format state property for JSON requests', async function() {
      router.get('/p/:id', params => Promise.resolve(params))
      expect(await runAll('get', '/p/foo.json')).toEqual({ id: 'foo', format: 'json' })
    })

    it('should handle AMP format', async function() {
      router.get('/p/:id', params => Promise.resolve(params))
      expect(await runAll('get', '/p/foo.amp')).toEqual({ id: 'foo', format: 'amp' })
    })
  })

  describe('cache', function() {
    it('should set response.cache', async function() {
      router.get(
        '/foo',
        fromClient({ view: 'Foo' }),
        fromServer(() => ({ foo: 'bar' })),
        cache({
          edge: {
            maxAgeSeconds: 300
          }
        })
      )

      expect(await runAll('get', '/foo')).toEqual({ view: 'Foo', foo: 'bar' })
      expect(response.cache).toEqual({ browserMaxAge: 0, serverMaxAge: 300 })
    })
  })

  describe('use', function() {
    it('match a nested route', async function() {
      router.use('/products', new Router().get('/:id', handler))

      expect(await runAll('get', '/products/1')).toEqual({ id: '1' })
    })

    it('should accept params', async function() {
      router.use('/products/:id', new Router().get('/reviews/:reviewId', handler))

      expect(await runAll('get', '/products/1/reviews/2')).toEqual({ id: '1', reviewId: '2' })
    })

    it('should accept infinite levels of nesting', async function() {
      router.use(
        '/products',
        new Router()
          .get('/:productId', handler)
          .use('/:productId/reviews', new Router().get('/:reviewId', handler))
      )

      expect(await runAll('get', '/products/1/reviews/2')).toEqual({
        productId: '1',
        reviewId: '2'
      })
    })

    it('should match based on extension', async function() {
      router.use(
        '/c',
        new Router()
          .get('/:id.html', () => Promise.resolve('html'))
          .get('/:id.json', () => Promise.resolve('json'))
      )

      expect(await runAll('get', '/c/1.html')).toEqual('html')
      expect(await runAll('get', '/c/1.json')).toEqual('json')
    })
  })

  describe('configureClientCache', () => {
    it('should call configureCache', () => {
      const config = {
        cacheName: 'api',
        maxEntries: 200,
        maxAgeSeconds: 3600
      }
      expect(router.configureClientCache(config)).toBe(router)
      expect(serviceWorker.configureCache).toBeCalledWith(config)
    })
  })

  describe('applySearch', () => {
    it('should preserve existing query params', () => {
      const history = createMemoryHistory()
      history.push('/search?filter=test')

      router.watch(history, jest.fn()).applySearch({ sort: 'price' })

      expect(history.location.pathname + history.location.search).toEqual(
        '/search?filter=test&sort=price'
      )
    })

    it('should swap the existing query param of the same name', () => {
      const history = createMemoryHistory()
      history.push('/search?filter=test&sort=price')

      router.watch(history, jest.fn()).applySearch({ sort: 'name' })

      expect(history.location.pathname + history.location.search).toEqual(
        '/search?filter=test&sort=name'
      )
    })

    it('should change behaviour if custom stringifyOptions specified', () => {
      const history = createMemoryHistory()
      history.push('/search?sort=price')

      router.watch(history, jest.fn()).applySearch(
        { filter: ['f1', 'f2'] },
        {
          arrayFormat: 'brackets',
          encode: false
        }
      )

      expect(history.location.pathname + history.location.search).toEqual(
        '/search?sort=price&filter[]=f1&filter[]=f2'
      )
    })
  })

  describe('onLocationChange', () => {
    it('should update previous location on replace action', () => {
      const history = createMemoryHistory()
      history.push('/s/1?c=2')
      const handler = jest.fn()

      router.watch(history, jest.fn()).get('/s/:id', fromClient(handler))

      // There would be an underlying fetch that updates the state
      history.replace('/s/1?c=2&filters%5B0%5D=red')

      // Now back to same subcategory, but unfiltered
      history.push('/s/1?c=2')

      expect(handler).toHaveBeenCalled()
    })
  })

  describe('watch', () => {
    it('should not call any handlers until history changes', () => {
      process.env.MOOV_RUNTIME = 'client'
      const history = createMemoryHistory()
      history.push('/search')
      const handler = jest.fn()
      new Router().get('/search', handler).watch(history, jest.fn())
      expect(handler).not.toHaveBeenCalled()
    })

    it('should run route when history changes', () => {
      const history = createMemoryHistory()
      history.push('/')
      const handler = jest.fn()

      router.watch(history, jest.fn()).get('/search', fromClient(handler))

      history.push('/search')
      expect(handler).toHaveBeenCalled()
    })

    it('should not run route when previous location is the same as the new location', () => {
      const history = createMemoryHistory()
      history.push('/search')
      const handler = jest.fn()

      router.watch(history, jest.fn()).get('/search', fromClient(handler))

      history.push('/search')
      expect(handler).not.toHaveBeenCalled()
    })

    it('should restore the previous app state on back', () => {
      const handler = jest.fn()
      const history = createMemoryHistory()
      history.push('/search', { title: 'Search' })
      history.push('/c/1', { title: 'Category #1' })
      router.watch(history, handler)
      history.goBack()

      expect(handler).toHaveBeenCalledWith({ title: 'Search' }, 'POP')
    })

    it('should restore the previous app state on forward', () => {
      const handler = jest.fn()
      const history = createMemoryHistory()
      history.push('/search', { title: 'Search' })
      history.push('/c/1', { title: 'Category #1' })
      history.goBack()
      router.watch(history, handler)
      history.goForward()

      expect(handler).toHaveBeenCalledWith({ title: 'Category #1' }, 'POP')
    })

    it('should capture routeStart and routeEnd timing data', async () => {
      const history = createMemoryHistory()
      router.get('/', fromClient({ view: 'home' }))
      router.watch(history, Function.prototype)
      history.push('/')
      expect(window.moov.timing.routeStart)
    })

    it('should yield state from clicked Link', () => {
      process.env.MOOV_RUNTIME = 'client'

      const router = new Router()
      const handler = jest.fn()
      const history = createMemoryHistory({ initialEntries: ['/'] })
      router.get('/p/:id', fromClient({ foo: 'bar' })).watch(history, handler)
      history.push('/p/1', { product: { name: 'Test' } })

      return new Promise(resolve => {
        setTimeout(() => {
          expect(handler).toHaveBeenCalledWith(
            expect.objectContaining({ product: { name: 'Test' } }),
            'PUSH'
          )
          resolve()
        })
      })
    })
  })

  describe('willFetchFromUpstream', () => {
    it('should return true if the route has a proxyUpstream handler', () => {
      const router = new Router().get('/about', proxyUpstream())

      expect(router.willFetchFromUpstream({ path: '/about', search: '' })).toBe(true)
    })

    it('should return false if the route has no proxyUpstream handler', () => {
      const router = new Router().get('/about', proxyUpstream())

      expect(router.willFetchFromUpstream({ path: '/', search: '' })).toBe(false)
    })
  })

  describe('after', function() {
    it('should be called after all routes', async done => {
      const history = createMemoryHistory()

      const router = new Router().get('/foo', fromClient({})).watch(history, Function.prototype)

      const onAfter = jest.fn()
      const onBefore = jest.fn()

      router.on('after', onAfter)
      router.on('before', onBefore)

      history.push('/foo')

      setTimeout(() => {
        expect(onAfter).toHaveBeenCalled()
        expect(onBefore).toHaveBeenCalled()
        done()
      }, 500)
    })

    it('should fire an after event with initialLoad: true', () => {
      const history = createMemoryHistory()
      const onAfter = jest.fn()
      const router = new Router().get('/foo', fromClient({}))
      router.on('after', onAfter)
      router.watch(history, Function.prototype)
      expect(onAfter).toHaveBeenCalled()
    })
  })

  describe('Fetching within cacheable route', () => {
    it('should set send cookie ENV variable for fetch', async () => {
      router.get(
        '/new',
        cache({
          edge: { maxAgeSeconds: 300 }
        }),
        fromServer(() => {
          return Promise.resolve('NEW PRODUCTS')
        })
      )
      await runAll('get', '/new')
      expect(env.shouldSendCookies).toBe(false)
    })
  })

  describe('Caching and Cookies', () => {
    it('should warn when removing cookies on a cached route', async () => {
      router.get(
        '/new',
        cache({
          edge: { maxAgeSeconds: 300 }
        }),
        fromServer((params, request, response) => {
          response.set('set-cookie', 'foo=bar')
          return Promise.resolve({ some: 'data' })
        })
      )
      const res = await runAll('get', '/new')
      expect(env.shouldSendCookies).toBe(false)
      expect(console.warn).toHaveBeenCalledWith(
        '[react-storefront response]',
        'Cannot set cookies on cached route'
      )
    })
  })

  describe('appShell', () => {
    it('should add a get handler for /.app-shell', async () => {
      router.appShell(
        fromServer(() => {
          return { loading: true }
        })
      )
      const res = await runAll('get', '/.app-shell')
      expect(res).toEqual({ loading: true })
    })
  })

  describe('isAppShellConfigured', () => {
    it('should return false if appShell has not been called', () => {
      expect(router.isAppShellConfigured()).toBe(false)
    })

    it('should return true if appShell has been called', () => {
      router.appShell(
        fromServer(() => {
          return { loading: true }
        })
      )

      expect(router.isAppShellConfigured()).toBe(true)
    })
  })

  describe('fetchFreshState', () => {
    it('should run the route', async () => {
      router.get('/', {
        runOn: {
          client: true,
          server: true
        },
        fn: () => ({
          page: 'Home'
        })
      })
      const result = await router.fetchFreshState({ pathname: '/', search: '' })
      expect(result).toEqual({ page: 'Home' })
    })
  })

  describe('willNavigateToUpstream', () => {
    it('should return true if the route points to a proxyUpstream handler', () => {
      router.get('/', proxyUpstream(() => null))
      expect(router.willNavigateToUpstream('/')).toBe(true)
    })
  })

  describe('willCacheOnClient', () => {
    it('should return true if the route has a cache handler with client: true', () => {
      router.get('/p/:id', cache({ client: true }))
      expect(router.willCacheOnClient({ path: '/p/1.json' })).toBe(true)
    })

    it('should return true if the route has a cache handler with client: true in the fallback route', () => {
      router.fallback(cache({ client: true }))
      expect(router.willCacheOnClient({ path: '/p/1.json' })).toBe(true)
    })

    it('should return false if the route has a cache handler with client: false', () => {
      router.get('/cart')
      expect(router.willCacheOnClient({ path: '/cart.json' })).toBe(false)
    })
  })

  describe('when fromServer responses are cached on the client', () => {
    let handlerFn, serverHandler, request, runAll, serverResponse

    beforeEach(() => {
      process.env.MOOV_RUNTIME = 'client'
      handlerFn = jest.fn()
      serverHandler = fromServer(handlerFn)
      request = { path: '/p/1', search: '' }
      response = new Response()
      response.cacheOnClient = jest.fn()
      serverResponse = { product: { name: 'test' } }

      serverHandler.getCachedResponse = jest.fn(() => Promise.resolve(serverResponse))

      runAll = async router => {
        const results = []

        for await (let result of router.run(request, response)) {
          results.push(result)
        }
        return results
      }
    })

    it('should skip the fetch when cache({ client: true }) is present', async () => {
      const router = new Router().get(
        '/p/:id',
        cache({ client: true }),
        fromClient({ page: 'Product' }),
        serverHandler
      )
      const results = await runAll(router)
      expect(serverHandler.getCachedResponse).toHaveBeenCalled()
      expect(results).toHaveLength(1)
      expect(handlerFn).not.toHaveBeenCalled()
    })

    it('should fetch when cache({ client: false }) is present, even if there is a cached result', async () => {
      const router = new Router().get(
        '/p/:id',
        cache({ client: false }),
        fromClient({ page: 'Product' }),
        serverHandler
      )
      await runAll(router)
      expect(handlerFn).toHaveBeenCalled()
    })

    it('should fetch when cache({ client: true }) is present if there is no cached result', async () => {
      const router = new Router().get(
        '/p/:id',
        cache({ client: true }),
        fromClient({ page: 'Product' }),
        serverHandler
      )
      serverHandler.getCachedResponse = jest.fn(() => null)
      await runAll(router)
      expect(handlerFn).toHaveBeenCalled()
    })

    it('should yield the cached response even when there is no fromClient handler', async () => {
      const router = new Router().get('/p/:id', cache({ client: true }), serverHandler)
      const result = await runAll(router)

      expect(result).toEqual([
        {
          loading: false,
          location: {
            hostname: 'localhost',
            pathname: '/',
            port: '',
            protocol: 'http',
            search: ''
          },
          product: { name: 'test' }
        }
      ])
    })
  })

  describe('createEdgeConfiguration', () => {
    let key, cacheHandler

    beforeEach(() => {
      key = createCustomCacheKey()
        .addHeader('user-agent')
        .addHeader('host')
        .excludeQueryParameters(['uid', 'gclid'])
        .addCookie('currency')
        .addCookie('location', cookie => {
          cookie.partition('na').byPattern('us|ca')
          cookie.partition('eur').byPattern('de|fr|ee')
        })
      cacheHandler = cache({
        edge: {
          maxAgeSeconds: 300,
          key
        }
      })
    })

    it('should generate custom cache keys for outer edge manager', () => {
      const router = new Router().get('/', cacheHandler).get('/p/:id', cacheHandler)
      const config = router.createEdgeConfiguration()

      expect(config.custom_cache_keys).toEqual([
        {
          notes: 'rsf: /.powerlinks.js.json',
          path_regex: '^/\\.powerlinks\\.js\\.json(?=\\?|$)'
        },
        {
          notes: 'rsf: /.powerlinks.js.amp',
          path_regex: '^/\\.powerlinks\\.js\\.amp(?=\\?|$)'
        },
        { notes: 'rsf: /.powerlinks.js', path_regex: '^/\\.powerlinks\\.js(?=\\?|$)' },
        {
          add_cookies: {
            currency: null,
            location: [
              { partition: 'na', partitioning_regex: 'us|ca' },
              { partition: 'eur', partitioning_regex: 'de|fr|ee' }
            ]
          },
          add_headers: ['user-agent', 'host'],
          notes: 'rsf: /.json',
          path_regex: '^/\\.json(?=\\?|$)',
          query_parameters_list: ['uid', 'gclid'],
          query_parameters_mode: 'blacklist'
        },
        {
          add_cookies: {
            currency: null,
            location: [
              { partition: 'na', partitioning_regex: 'us|ca' },
              { partition: 'eur', partitioning_regex: 'de|fr|ee' }
            ]
          },
          add_headers: ['user-agent', 'host'],
          notes: 'rsf: /.amp',
          path_regex: '^/\\.amp(?=\\?|$)',
          query_parameters_list: ['uid', 'gclid'],
          query_parameters_mode: 'blacklist'
        },
        {
          add_cookies: {
            currency: null,
            location: [
              { partition: 'na', partitioning_regex: 'us|ca' },
              { partition: 'eur', partitioning_regex: 'de|fr|ee' }
            ]
          },
          add_headers: ['user-agent', 'host'],
          notes: 'rsf: /',
          path_regex: '^/(?=\\?|$)',
          query_parameters_list: ['uid', 'gclid'],
          query_parameters_mode: 'blacklist'
        },
        {
          add_cookies: {
            currency: null,
            location: [
              { partition: 'na', partitioning_regex: 'us|ca' },
              { partition: 'eur', partitioning_regex: 'de|fr|ee' }
            ]
          },
          add_headers: ['user-agent', 'host'],
          notes: 'rsf: /p/:id.json',
          path_regex: '^/p/([^/\\?]+)\\.json(?=\\?|$)',
          query_parameters_list: ['uid', 'gclid'],
          query_parameters_mode: 'blacklist'
        },
        {
          add_cookies: {
            currency: null,
            location: [
              { partition: 'na', partitioning_regex: 'us|ca' },
              { partition: 'eur', partitioning_regex: 'de|fr|ee' }
            ]
          },
          add_headers: ['user-agent', 'host'],
          notes: 'rsf: /p/:id.amp',
          path_regex: '^/p/([^/\\?]+)\\.amp(?=\\?|$)',
          query_parameters_list: ['uid', 'gclid'],
          query_parameters_mode: 'blacklist'
        },
        {
          add_cookies: {
            currency: null,
            location: [
              { partition: 'na', partitioning_regex: 'us|ca' },
              { partition: 'eur', partitioning_regex: 'de|fr|ee' }
            ]
          },
          add_headers: ['user-agent', 'host'],
          notes: 'rsf: /p/:id',
          path_regex: '^/p/([^/\\?]+)(?=\\?|$)',
          query_parameters_list: ['uid', 'gclid'],
          query_parameters_mode: 'blacklist'
        },
        { notes: 'rsf: __fallback__', path_regex: '.' }
      ])
    })

    describe('edge proxy configuration', () => {
      it('should proxy to given origin', () => {
        const router = new Router().get('/foo', fromOrigin('desktop'))
        const routes = router.createEdgeConfiguration().router
        expect(routes).toEqual([
          {
            notes: 'rsf: /.powerlinks.js.json',
            path_regex: '^/\\.powerlinks\\.js\\.json(?=\\?|$)',
            proxy: { backend: 'moov' }
          },
          {
            notes: 'rsf: /.powerlinks.js.amp',
            path_regex: '^/\\.powerlinks\\.js\\.amp(?=\\?|$)',
            proxy: { backend: 'moov' }
          },
          {
            notes: 'rsf: /.powerlinks.js',
            path_regex: '^/\\.powerlinks\\.js(?=\\?|$)',
            proxy: { backend: 'moov' }
          },
          {
            notes: 'rsf: /foo.json',
            path_regex: '^/foo\\.json(?=\\?|$)',
            proxy: { backend: 'desktop' }
          },
          {
            notes: 'rsf: /foo.amp',
            path_regex: '^/foo\\.amp(?=\\?|$)',
            proxy: { backend: 'desktop' }
          },
          {
            notes: 'rsf: /foo',
            path_regex: '^/foo(?=\\?|$)',
            proxy: { backend: 'desktop' }
          },
          { notes: 'rsf: __fallback__', path_regex: '.', proxy: { backend: 'moov' } }
        ])
      })
      it('should handle fallback(fromOrigin)', () => {
        const router = new Router().get('/foo', fromServer('./foo')).fallback(fromOrigin())
        expect(router.createEdgeConfiguration().router).toEqual([
          {
            notes: expect.any(String),
            path_regex: '^/\\.powerlinks\\.js\\.json(?=\\?|$)',
            proxy: { backend: 'moov' }
          },
          {
            notes: expect.any(String),
            path_regex: '^/\\.powerlinks\\.js\\.amp(?=\\?|$)',
            proxy: { backend: 'moov' }
          },
          {
            notes: expect.any(String),
            path_regex: '^/\\.powerlinks\\.js(?=\\?|$)',
            proxy: { backend: 'moov' }
          },
          {
            notes: expect.any(String),
            path_regex: '^/foo\\.json(?=\\?|$)',
            proxy: { backend: 'moov' }
          },
          {
            notes: expect.any(String),
            path_regex: '^/foo\\.amp(?=\\?|$)',
            proxy: { backend: 'moov' }
          },
          {
            notes: expect.any(String),
            path_regex: '^/foo(?=\\?|$)',
            proxy: { backend: 'moov' }
          },
          {
            notes: expect.any(String),
            path_regex: '.',
            proxy: { backend: 'origin' }
          }
        ])
      })
      it('should add caching to backends.response_router', () => {
        const router = new Router().get(
          '/foo',
          cache({ edge: { maxAgeSeconds: 500 } }),
          fromOrigin('desktop')
        )
        const config = router.createEdgeConfiguration()

        expect(config.router[5]).toEqual({
          notes: 'rsf: /foo',
          path_regex: '^/foo(?=\\?|$)',
          proxy: {
            backend: 'desktop'
          }
        })

        expect(config.backends).toEqual({
          desktop: {
            response_router: [
              {
                notes: 'autogenerated from rsf oem.json',
                path_regex: '^/foo\\.json(?=\\?|$)',
                ttl: '500s'
              },
              {
                notes: 'autogenerated from rsf oem.json',
                path_regex: '^/foo\\.amp(?=\\?|$)',
                ttl: '500s'
              },
              {
                notes: 'autogenerated from rsf oem.json',
                path_regex: '^/foo(?=\\?|$)',
                ttl: '500s'
              }
            ]
          }
        })
      })
      it('should proxy to given origin with transformed path', () => {
        const router = new Router().get(
          '/foo/:cat/:id',
          fromOrigin('desktop').transformPath('/bar/{cat}/{id}')
        )
        expect(router.createEdgeConfiguration().router).toEqual([
          {
            notes: 'rsf: /.powerlinks.js.json',
            path_regex: '^/\\.powerlinks\\.js\\.json(?=\\?|$)',
            proxy: { backend: 'moov' }
          },
          {
            notes: 'rsf: /.powerlinks.js.amp',
            path_regex: '^/\\.powerlinks\\.js\\.amp(?=\\?|$)',
            proxy: { backend: 'moov' }
          },
          {
            notes: 'rsf: /.powerlinks.js',
            path_regex: '^/\\.powerlinks\\.js(?=\\?|$)',
            proxy: { backend: 'moov' }
          },
          {
            notes: 'rsf: /foo/:cat/:id.json',
            path_regex: '^/foo/([^/\\?]+)/([^/\\?]+)\\.json(?=\\?|$)',
            proxy: { backend: 'desktop', rewrite_path_regex: '/bar/\\1/\\2' }
          },
          {
            notes: 'rsf: /foo/:cat/:id.amp',
            path_regex: '^/foo/([^/\\?]+)/([^/\\?]+)\\.amp(?=\\?|$)',
            proxy: { backend: 'desktop', rewrite_path_regex: '/bar/\\1/\\2' }
          },
          {
            notes: 'rsf: /foo/:cat/:id',
            path_regex: '^/foo/([^/\\?]+)/([^/\\?]+)(?=\\?|$)',
            proxy: { backend: 'desktop', rewrite_path_regex: '/bar/\\1/\\2' }
          },
          { notes: 'rsf: __fallback__', path_regex: '.', proxy: { backend: 'moov' } }
        ])
      })
      it('should redirect with status', () => {
        const router = new Router().get('/foo', redirectTo('/bar').withStatus(302))
        const routes = router.createEdgeConfiguration().router
        expect(routes[5]).toEqual({
          notes: 'rsf: /foo',
          path_regex: '^/foo(?=\\?|$)',
          redirect: {
            status: 302,
            rewrite_path_regex: '/bar'
          }
        })
      })
      it('should redirect with status and path transformation', () => {
        const router = new Router().get('/foo/*path', redirectTo('/bar/{path}').withStatus(200))
        const routes = router.createEdgeConfiguration().router
        expect(routes[5]).toEqual({
          notes: 'rsf: /foo/*path',
          path_regex: '^/foo/([^?]*?)(?=\\?|$)',
          redirect: {
            status: 200,
            rewrite_path_regex: '/bar/\\1'
          }
        })
      })
      it('should support a transformed path with multiple uses of variable', () => {
        const router = new Router().get(
          '/foo/:x/:y',
          fromOrigin('desktop').transformPath('/bar/{x}/{y}/{x}')
        )
        const config = router.createEdgeConfiguration().router[5]

        expect(config).toEqual({
          notes: 'rsf: /foo/:x/:y',
          path_regex: '^/foo/([^/\\?]+)/([^/\\?]+)(?=\\?|$)',
          proxy: {
            backend: 'desktop',
            rewrite_path_regex: '/bar/\\1/\\2/\\1'
          }
        })
        // Test regex replacement
        expect(
          '/foo/a/b'.replace(
            new RegExp(config.path_regex),
            config.proxy.rewrite_path_regex.replace(/\\/g, '$')
          )
        ).toEqual('/bar/a/b/a')
      })
      it('should leave escaped paths alone', () => {
        const router = new Router().get(
          '/foo/:x',
          fromOrigin('desktop').transformPath('/bar/\\{x}/{x}')
        )
        const config = router.createEdgeConfiguration().router[5]
        expect(config).toEqual({
          notes: 'rsf: /foo/:x',
          path_regex: '^/foo/([^/\\?]+)(?=\\?|$)',
          proxy: {
            backend: 'desktop',
            rewrite_path_regex: '/bar/\\{x}/\\1'
          }
        })
        // Test regex replacement
        expect(
          '/foo/a'.replace(
            new RegExp(config.path_regex),
            config.proxy.rewrite_path_regex.replace(/\\\d/g, '$$1')
          )
        ).toEqual('/bar/\\{x}/a')
      })
      it('should handle variable at beginning of path', () => {
        const router = new Router().get('/foo/:x', fromOrigin('desktop').transformPath('{x}/bar'))
        const routes = router.createEdgeConfiguration().router
        expect(routes[5]).toEqual({
          notes: 'rsf: /foo/:x',
          path_regex: '^/foo/([^/\\?]+)(?=\\?|$)',
          proxy: {
            backend: 'desktop',
            rewrite_path_regex: '\\1/bar'
          }
        })
      })
      it('should handle variable within a path param', () => {
        const router = new Router().get('/foo/:x', fromOrigin('desktop').transformPath('/bar{x}'))
        const routes = router.createEdgeConfiguration().router
        expect(routes[5]).toEqual({
          notes: 'rsf: /foo/:x',
          path_regex: '^/foo/([^/\\?]+)(?=\\?|$)',
          proxy: {
            backend: 'desktop',
            rewrite_path_regex: '/bar\\1'
          }
        })
      })
      it('should not support fromOrigin when not at edge', async () => {
        router.get('/foo/:x', fromOrigin('desktop'))
        await runAll('get', '/foo/1')
        expect(response.statusCode).toEqual(500)
      })
      it('should redirect with transformed path when not at edge and using redirectTo', async () => {
        router.get('/foo/:x/:y', redirectTo('/bar/{x}/x-{y}/{x}'))
        await runAll('get', '/foo/1/2')
        expect(response.redirectTo).toEqual('/bar/1/x-2/1')
      })
    })
  })

  afterAll(() => {
    jest.unmock('../../src/router/serviceWorker')
  })
})
