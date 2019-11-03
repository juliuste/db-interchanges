'use strict'

const queryOverpass = require('@derhuerst/query-overpass')
const first = require('lodash/first')
const reverse = require('lodash/reverse')
const uniq = require('lodash/fp/uniq')
const graphlib = require('graphlib')
const { buildOsmGraphs } = require('./osm-graph')

const fetchFromOsm = async ({ id: fromId, type: fromType }, { id: toId, type: toType }) => {
	const elements = await queryOverpass(`
		[out:json];
		(
			${fromType}(${fromId});
			${toType}(${toId});
		)->.perrons;
		(
			way[highway](around.perrons:200);
			node[highway=elevator](around.perrons:200);
			way(r.perrons);
			.perrons;
		);
		out geom;
	`, { endpoint: 'https://overpass.nchc.org.tw/api/interpreter', retryOpts: { retries: 3, minTimeout: 2500 } })
	return elements
}

const matchesOsmItem = osmItem => nwr => nwr.type === osmItem.type && String(nwr.id) === String(osmItem.id)

const buildPath = (route, toNodeId) => {
	let currentNode = route[String(toNodeId)]
	if (!currentNode || !currentNode.predecessor) return false
	const path = [String(toNodeId)]
	while (currentNode.predecessor) {
		path.push(currentNode.predecessor)
		currentNode = route[currentNode.predecessor]
	}
	return path
}

const elevatorsForPath = (graph, path) => {
	return uniq(reverse(path)
		.filter((_, index) => index < path.length - 1)
		.map((nodeId, index) => graph.edge(nodeId, path[index + 1]))
		.filter(edge => edge.elevator && edge.elevatorId)
		.map(edge => edge.elevatorId)
	)
}

const osmInterchange = async (from, to, fetchFasta) => {
	const elements = await fetchFromOsm(from, to)

	const fromPerron = elements.find(matchesOsmItem(from))
	const toPerron = elements.find(matchesOsmItem(to))
	if (!fromPerron || !toPerron) return null

	// @todo
	const fromPerronOuter = from.type === 'relation' ? (fromPerron.members || []).find(member => member.type === 'way' && member.role === 'outer') : { ref: +from.id }
	const toPerronOuter = to.type === 'relation' ? (toPerron.members || []).find(member => member.type === 'way' && member.role === 'outer') : { ref: +to.id }
	if (!fromPerronOuter || !toPerronOuter) return null
	const fromPerronOuterWay = elements.find(f => f.type === 'way' && f.id === fromPerronOuter.ref)
	const toPerronOuterWay = elements.find(f => f.type === 'way' && f.id === toPerronOuter.ref)
	if (!fromPerronOuterWay || !toPerronOuterWay) return null

	const fromNodeId = first(fromPerronOuterWay.nodes) // @todo
	const toNodeId = first(toPerronOuterWay.nodes) // @todo
	if (!fromNodeId || !toNodeId) return null

	const waysAndNodes = elements
		.filter(f => f.type !== 'relation' || (!matchesOsmItem(from)(f) && !matchesOsmItem(to)(f)))

	// @todo use dijkstra.edgeFn instead of generating multiple graphs for routing
	const { activeAndUnknown, onlyActive } = await buildOsmGraphs(waysAndNodes, fetchFasta)
	const edgeWeight = graph => e => graph.edge(e).weight
	const activeAndUnknownRoute = graphlib.alg.dijkstra(activeAndUnknown, String(fromNodeId), edgeWeight(activeAndUnknown), n => activeAndUnknown.nodeEdges(n))
	const onlyActiveRoute = graphlib.alg.dijkstra(onlyActive, String(fromNodeId), edgeWeight(onlyActive), n => onlyActive.nodeEdges(n))

	const activeAndUnknownPath = buildPath(activeAndUnknownRoute, toNodeId)
	const onlyActivePath = buildPath(onlyActiveRoute, toNodeId)

	if (onlyActivePath) return { barrierFree: true, elevators: elevatorsForPath(onlyActive, onlyActivePath) }
	if (activeAndUnknownPath) return { barrierFree: null, elevators: elevatorsForPath(activeAndUnknown, activeAndUnknownPath) }
	return { barrierFree: false }
}

module.exports = { osmInterchange }
