'use strict'

const queryOverpass = require('@derhuerst/query-overpass')
const first = require('lodash/first')
const reverse = require('lodash/reverse')
const merge = require('lodash/merge')
const sortBy = require('lodash/sortBy')
const pick = require('lodash/pick')
const uniq = require('lodash/fp/uniq')
const graphlib = require('graphlib')
const { buildOsmGraphs } = require('./osm-graph')

const osmEqualsMember = osmItem => member => member.type === osmItem.type && member.ref === osmItem.id

const flattenOsmOutput = osmOutput => {
	return osmOutput
		.map(osmItem => {
			if (osmItem.type === 'relation') return null
			if (osmItem.type === 'node') return osmItem
			const parents = osmOutput.filter(i => i.members && i.members.find(osmEqualsMember(osmItem)))
			return {
				...osmItem,
				parents: parents.map(p => ({
					...pick(p, ['id', 'type']),
					role: p.members.find(osmEqualsMember(osmItem)).role
				})),
				tags: merge(
					...parents.map(p => p.tags || {}),
					osmItem.tags
				)
			}
		})
		.filter(Boolean)
}

const fetchFromOsm = async ({ id: fromId, type: fromType }, { id: toId, type: toType }) => {
	const elements = await queryOverpass(`
		[out:json];
		(
			${fromType}(${fromId});
			${toType}(${toId});
		)->.perrons;
		rel[~"^(railway|public_transport)$"~"^(platform|platform_edge)$"](around.perrons:200)->.platformRels;
		rel[highway][area="yes"](around.perrons:200)->.areaRels;
		(
			way[highway](around.perrons:200);
			node[highway=elevator](around.perrons:200);

			way[area="yes"](around.perrons:200);
			way(r.areaRels);
			.areaRels;

			way[~"^(railway|public_transport)$"~"^(platform|platform_edge)$"](around.perrons:200);
			way(r.platformRels);
			way(r.perrons);
			.platformRels;
			.perrons;
		);
		out geom;
	`, { endpoint: 'https://overpass.juliustens.eu/api/interpreter', retryOpts: { retries: 3, minTimeout: 2500 } })
	return elements
}

const buildPath = (route, toNodeId) => {
	let currentNode = route[String(toNodeId)]
	if (!currentNode) return false
	const path = [String(toNodeId)]
	if (currentNode.distance === 0) return path
	if (!currentNode.predecessor) return false
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

const osmEquals = nwr1 => nwr2 => nwr1.type === nwr2.type && String(nwr1.id) === String(nwr2.id)
const matchesOsmItem = osmItem => nwr => osmEquals(osmItem)(nwr) || nwr.parents.some(osmEquals(osmItem))

const outerWaysFirst = ways => sortBy(ways, way => way.parents.some(p => p.role === 'outer') ? 0 : 1)

const osmInterchange = async (from, to, fetchFasta) => {
	const elements = await fetchFromOsm(from, to)
	const waysAndNodes = flattenOsmOutput(elements)

	// @todo
	const fromPerron = outerWaysFirst(waysAndNodes.filter(e => e.type !== 'node')).find(matchesOsmItem(from))
	const toPerron = outerWaysFirst(waysAndNodes.filter(e => e.type !== 'node')).find(matchesOsmItem(to))
	if (!fromPerron || !toPerron) return null

	const fromNodeId = first(fromPerron.nodes) // @todo
	const toNodeId = first(toPerron.nodes) // @todo
	if (!fromNodeId || !toNodeId) return null

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
