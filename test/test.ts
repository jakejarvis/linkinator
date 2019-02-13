import * as assert from 'assert';
import * as gaxios from 'gaxios';
import * as nock from 'nock';
import * as sinon from 'sinon';

import {check, LinkState} from '../src';

nock.disableNetConnect();
nock.enableNetConnect('localhost');

describe('linkinator', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('should perform a basic shallow scan', async () => {
    const scope = nock('http://fake.local').get('/').reply(200);
    const results = await check({path: 'test/fixtures/basic'});
    assert.ok(results.passed);
    scope.done();
  });

  it('should only try a link once', async () => {
    const scope = nock('http://fake.local').get('/').reply(200);
    const results = await check({path: 'test/fixtures/twice'});
    assert.ok(results.passed);
    assert.strictEqual(results.links.length, 2);
    scope.done();
  });

  it('should skip links if asked nicely', async () => {
    const results = await check(
        {path: 'test/fixtures/skip', linksToSkip: ['http://very.bad']});
    assert.ok(results.passed);
    assert.strictEqual(
        results.links.filter(x => x.state === LinkState.SKIPPED).length, 1);
  });

  it('should report broken links', async () => {
    const scope = nock('http://fake.local').get('/').reply(404);
    const results = await check({path: 'test/fixtures/broke'});
    assert.ok(!results.passed);
    assert.strictEqual(
        results.links.filter(x => x.state === LinkState.BROKEN).length, 1);
    scope.done();
  });

  it('should handle relative links', async () => {
    const results = await check({path: 'test/fixtures/relative'});
    assert.ok(results.passed);
    assert.strictEqual(results.links.length, 2);
  });

  it('should handle fetch exceptions', async () => {
    const requestStub = sinon.stub(gaxios, 'request');
    requestStub.throws('Fetch error');
    const results = await check({path: 'test/fixtures/basic'});
    assert.ok(!results.passed);
    assert.strictEqual(
        results.links.filter(x => x.state === LinkState.BROKEN).length, 1);
    requestStub.restore();
  });

  it('should skip mailto: links', async () => {
    const results = await check({path: 'test/fixtures/mailto'});
    assert.ok(results.passed);
    assert.strictEqual(
        results.links.filter(x => x.state === LinkState.SKIPPED).length, 1);
  });

  it('should detect broken image links', async () => {
    const results = await check({path: 'test/fixtures/image'});
    assert.strictEqual(
        results.links.filter(x => x.state === LinkState.BROKEN).length, 1);
    assert.strictEqual(
        results.links.filter(x => x.state === LinkState.OK).length, 2);
  });

  it('should perform a recursive scan', async () => {
    // This test is making sure that we do a recursive scan of links,
    // but also that we don't follow links to another site
    const scope = nock('http://fake.local')
                      .get('/')
                      .replyWithFile(200, 'test/fixtures/recurse/fake.html');
    const results = await check({path: 'test/fixtures/recurse', recurse: true});
    assert.strictEqual(results.links.length, 5);
    scope.done();
  });

  it('should not recurse by default', async () => {
    const results = await check({path: 'test/fixtures/recurse'});
    assert.strictEqual(results.links.length, 2);
  });
});
