'use strict'

const tapeWithoutPromise = require('tape')
const addPromiseSupport = require('tape-promise').default
const tape = addPromiseSupport(tapeWithoutPromise)

const getLiveInterchange = require('.')
const { interchangeWithFetchFasta } = require('.')
const fastaFixtures = require('./fasta-fixtures.json')
const getInterchange = interchangeWithFetchFasta(() => async () => fastaFixtures)

tape('leipzig messe (all working)', async t => {
	const stationId = '8012478'
	const fromPlatform = '1'
	const toPlatform = '3'
	const from = { stationId, platform: fromPlatform }
	const to = { stationId, platform: toPlatform }
	const interchange = await getInterchange(from, to)
	t.deepEquals(interchange, {
		barrierFree: true,
		elevators: ['10068718', '10200698']
	})
	const reverseInterchange = await getInterchange(to, from)
	t.deepEquals(reverseInterchange, {
		barrierFree: true,
		elevators: ['10200698', '10068718']
	})
})

tape('leipzig hbf (no elevator needed)', async t => {
	const stationId = '8010205'
	const fromPlatform = '15'
	const toPlatform = '9'
	const from = { stationId, platform: fromPlatform }
	const to = { stationId, platform: toPlatform }
	const interchange = await getInterchange(from, to)
	t.deepEquals(interchange, {
		barrierFree: true,
		elevators: []
	})
})

tape('leipzig hbf (broken elevator)', async t => {
	const stationId = '8010205'
	const fromPlatform = '13'
	const toPlatform = '1'
	const from = { stationId, platform: fromPlatform }
	const to = { stationId, platform: toPlatform }
	const interchange = await getInterchange(from, to)
	t.deepEquals(interchange, {
		barrierFree: false
	})
})

tape('goslar (no perrons/tracks mapped)', async t => {
	const stationId = '8000130'
	const fromPlatform = '1'
	const toPlatform = '5'
	const from = { stationId, platform: fromPlatform }
	const to = { stationId, platform: toPlatform }
	const interchange = await getInterchange(from, to)
	t.deepEquals(interchange, null)
})

tape('anhalter bahnhof (no elevators matched)', async t => {
	const stationId = '8089002'
	const fromPlatform = '2'
	const toPlatform = '4'
	const from = { stationId, platform: fromPlatform }
	const to = { stationId, platform: toPlatform }
	const interchange = await getInterchange(from, to)
	t.deepEquals(interchange, {
		barrierFree: false
	})
})

tape('berlin nikolassee (unknown elevator)', async t => {
	const stationId = '8089078'
	const fromPlatform = '3'
	const toPlatform = '2'
	const from = { stationId, platform: fromPlatform }
	const to = { stationId, platform: toPlatform }
	const interchange = await getInterchange(from, to)
	t.deepEquals(interchange, {
		barrierFree: null,
		elevators: ['10447402', '10313413']
	})
})

tape('berlin ostkreuz (broken elevator, deviation via other elevators)', async t => {
	const stationId = '8011162'
	const fromPlatform = '11'
	const toPlatform = '6'
	const from = { stationId, platform: fromPlatform }
	const to = { stationId, platform: toPlatform }
	const interchange = await getInterchange(from, to)
	t.deepEquals(interchange, {
		barrierFree: true,
		elevators: ['10499262', '10499261', '10499260']
	})
})

tape('berlin yorckstraße (different ids for from/to stations)', async t => {
	// yorckstraße
	const fromStationId = '8089050'
	const fromPlatform = '1'
	const from = { stationId: fromStationId, platform: fromPlatform }

	// yorckstraße/großgörschenstraße
	const toStationId = '8089051'
	const toPlatform = '1'
	const to = { stationId: toStationId, platform: toPlatform }

	const interchange = await getInterchange(from, to)
	t.deepEquals(interchange, {
		barrierFree: false
	})
})

tape('berlin nikolasssee (live)', async t => {
	const stationId = '8089078'
	const fromPlatform = '3'
	const toPlatform = '2'
	const from = { stationId, platform: fromPlatform }
	const to = { stationId, platform: toPlatform }
	const interchange = await getLiveInterchange(from, to)
	t.deepEquals(interchange, {
		barrierFree: true,
		elevators: ['10447402', '10313413']
	})
})
