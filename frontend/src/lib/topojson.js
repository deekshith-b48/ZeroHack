// Minimal implementation of topojson functions needed for our D3 maps
// This file provides the topojson.feature function used in our threat map

const topojson = {
  feature: function(topology, o) {
    return {
      type: "FeatureCollection",
      features: o.geometries.map(function(o) {
        return {
          type: "Feature",
          properties: o.properties || {},
          geometry: topojson.geometry(topology, o)
        };
      })
    };
  },
  geometry: function(topology, o) {
    if (o.type === "GeometryCollection") return {
      type: o.type,
      geometries: o.geometries.map(function(o) {
        return topojson.geometry(topology, o);
      })
    };

    var arcs = topology.arcs;
    var geometryType = o.type;
    
    var coords;
    if (geometryType === "Point") {
      coords = o.coordinates;
    } else if (geometryType === "MultiPoint") {
      coords = o.coordinates;
    } else if (geometryType === "LineString") {
      coords = extractLineString(arcs, o.arcs);
    } else if (geometryType === "MultiLineString") {
      coords = o.arcs.map(function(a) { return extractLineString(arcs, a); });
    } else if (geometryType === "Polygon") {
      coords = o.arcs.map(function(a) { return extractLineString(arcs, a); });
    } else if (geometryType === "MultiPolygon") {
      coords = o.arcs.map(function(a) {
        return a.map(function(b) { return extractLineString(arcs, b); });
      });
    } else {
      return null;
    }
    
    return {
      type: geometryType,
      coordinates: coords
    };
  }
};

function extractLineString(arcs, indices) {
  var line = [];
  for (var i = 0; i < indices.length; i++) {
    var arcIndex = indices[i];
    var arc = arcs[Math.abs(arcIndex)];
    var start = 0;
    var end = arc.length;
    var reversed = arcIndex < 0;

    if (reversed) {
      var tmp = start;
      start = end;
      end = tmp;
    }

    for (var j = start; reversed ? j > end : j < end; reversed ? j-- : j++) {
      line.push(arc[j]);
    }
  }
  return line;
}

export default topojson;
