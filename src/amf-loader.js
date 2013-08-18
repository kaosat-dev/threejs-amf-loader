/**
 * @author kaosat-dev
 *
 * Description: A THREE loader for AMF files (3d printing, cad, sort of a next gen stl).
 *
 * Usage:
 * 	var loader = new THREE.AMFLoader();
 * 	loader.addEventListener( 'load', function ( event ) {
 *
 * 		var geometry = event.content;
 * 		scene.add( new THREE.Mesh( geometry ) );
 *
 * 	} );
 * 	loader.load( './models/amf/slotted_disk.amf' );
 */


THREE.AMFLoader = function () {};

THREE.AMFLoader.prototype = {

	constructor: THREE.AMFLoader

};

THREE.AMFLoader.prototype.load = function (url, callback) {

	var scope = this;

	var xhr = new XMLHttpRequest();

	function onloaded( event ) {

		if ( event.target.status === 200 || event.target.status === 0 ) {

				var geometry = scope.parse( event.target.response || event.target.responseText );

				scope.dispatchEvent( { type: 'load', content: geometry } );

				if ( callback ) callback( geometry );

		} else {

			scope.dispatchEvent( { type: 'error', message: 'Couldn\'t load URL [' + url + ']',
				response: event.target.responseText } );

		}

	}

	xhr.addEventListener( 'load', onloaded, false );

	xhr.addEventListener( 'progress', function ( event ) {

		scope.dispatchEvent( { type: 'progress', loaded: event.loaded, total: event.total } );

	}, false );

	xhr.addEventListener( 'error', function () {

		scope.dispatchEvent( { type: 'error', message: 'Couldn\'t load URL [' + url + ']' } );

	}, false );

	xhr.overrideMimeType('text/plain; charset=x-user-defined');
	xhr.open( 'GET', url, true );
	xhr.responseType = "text";
	xhr.send( null );

};

THREE.AMFLoader.prototype.parse = function (data) {

	function extractMetaData( node )
	{
		var metadataList = node.getElementsByTagName("metadata");
		var result = {};
		for (var i=0; i<metadataList.length;i++)
		{
			var current = metadataList[i];
			if (current.parentNode == node)
			{
				var name = current.attributes.getNamedItem("type").nodeValue;
				var value = current.textContent;
				result[name] = value;
			}
		}
		return result;
	}
	function parseTagText( node , name, toType , defaultValue)
	{
		defaultValue = defaultValue || null;
		
		var value = node.getElementsByTagName(name)[0].textContent;

		if( value !== null && value !== undefined )
		{
			switch(toType)
			{
				case "float":
					value = parseFloat(value);
				break;
			
				case "int":
					value = parseInt(value);
				//default:

			}
		}
		else if (defaultValue !== null)
		{
			value = defaultValue;
		}
		return value;
	}

	var xmlDoc = this._parseXML( data );
	var root = xmlDoc.documentElement;
	if( root.nodeName !== "amf")
	{
		throw("Unvalid AMF document, should have a root node called 'amf'");
	}

	var objectsData = root.getElementsByTagName("object"); 
	var rootObj = new THREE.Object3D(); //storage of actual objects /meshes
	var objectsHash = {}; //temporary storage of instances helper for amf

	for (var i=0; i< objectsData.length ; i++)
	{
		var currentGeometry = new THREE.Geometry();		

		var object = objectsData[i];

		var id = object.attributes.getNamedItem("id").nodeValue;
		console.log("object id",id);
		var meshData = object.getElementsByTagName("mesh")[0]; 
		
		//get vertices data
		var verticesData = meshData.getElementsByTagName("vertices"); 
		for (var j=0;j<verticesData.length;j++)
		{
			var vertice = verticesData[j];
			var vertexList = vertice.getElementsByTagName("vertex");

			for (var u=0; u<vertexList.length;u++)
			{
				var vertexData = vertexList[u];

				//get vertex position data
				var coordinates = vertexData.getElementsByTagName("coordinates")[0];
				
				var x = parseTagText( coordinates , "x", "float")
				var y = parseTagText( coordinates , "y", "float")
				var z = parseTagText( coordinates , "z", "float")
				console.log("x,y,z,",x,y,z);
				var vertex = new THREE.Vector3(x,y,z);

				//get vertex normal data (optional)
				var normals = vertexData.getElementsByTagName("normals")[0];
				if (normals !== null && normals !== undefined)
				{
					var x = normals.getElementsByTagName("x")[0].textContent;
					x = parseFloat(x);
					var y = normals.getElementsByTagName("y")[0].textContent;
					y = parseFloat(y);
					var z = normals.getElementsByTagName("z")[0].textContent;
					z = parseFloat(z);
					console.log("NORMALS x,y,z,",x,y,z);
					var normal = new THREE.Vector3(x,y,z);
				}
				
				currentGeometry.vertices.push(vertex);
			}
		}

		//get volume data
		var volumeData = meshData.getElementsByTagName("volume")[0]; 
		var colorData = meshData.getElementsByTagName("color");
		
		var trianglesList = volumeData.getElementsByTagName("triangle"); 
		for (var j=0;j<trianglesList.length;j++)
		{
			var triangle = trianglesList[j];

			var v1 = triangle.getElementsByTagName("v1")[0].textContent;
			v1 = parseInt(v1);
			var v2 = triangle.getElementsByTagName("v2")[0].textContent;
			v2 = parseInt(v2);
			var v3 = triangle.getElementsByTagName("v3")[0].textContent;
			v3 = parseInt(v3);
			console.log("v1,v2,v3,",v1,v2,v3);
			
			//add vertex indices to current geometry
			//THREE.Face3 = function ( a, b, c, normal, color, materialIndex )
			currentGeometry.faces.push( new THREE.Face3( v1, v2, v3 ) );

			//get vertex UVs (optional)
			var mapping = triangle.getElementsByTagName("map")[0];
			if (mapping !== null && mapping !== undefined)
			{
				var u1 = mapping.getElementsByTagName("u1")[0].textContent;
				u1 = parseInt(u1);
				var u2 = mapping.getElementsByTagName("u2")[0].textContent;
				u2 = parseInt(u2);
				var u3 = mapping.getElementsByTagName("u3")[0].textContent;
				u3 = parseInt(u3);

				//geometry.faceVertexUvs[ 0 ].push( uvCopy )
			}


		}
		var currentMaterial = new THREE.MeshLambertMaterial( { color: 0x000000} ); //TODO: only do this if no material/texture was specified
		currentMaterial = new THREE.MeshNormalMaterial();
		var currentMesh = new THREE.Mesh(currentGeometry, currentMaterial);
		//TODO: only do this, if no normals were specified
		currentGeometry.computeFaceNormals();

		//add additional data to mesh
		var metadata = extractMetaData(object);//fix this, should go only one level down
		console.log("meta", metadata);
		//add meta data to mesh
		if('name' in metadata)
		{
			currentMesh.name = metadata.name;
		}

		rootObj.add( currentMesh );

	}
	var texturesData = root.getElementsByTagName("texture");
	var textures = {};
	if (texturesData !== undefined)
	{
		for (var j=0; j<texturesData.length; j++)
		{
			var textureData = texturesData[ j ];
			var rawImg = textureData.textContent;
			//cannot use imageLoader as it implies a seperate url
			//var loader = new THREE.ImageLoader();
			//loader.load( url, onLoad, onProgress, onError )
			var image = document.createElement( 'img' );
			image.src = 'data:image/png;base64,'+rawImg;
			var texture = new THREE.Texture( image );
			texture.needsUpdate = true;

			console.log("loaded texture");
			var textureId = textureData.attributes.getNamedItem("id").nodeValue;
			var textureType = textureData.attributes.getNamedItem("type").nodeValue;
			var textureTiling= textureData.attributes.getNamedItem("tiled").nodeValue
			textures[textureId] = texture;
		}

	}

	//, map:texture

	var materialsData = root.getElementsByTagName("material");
	var constellationData = root.getElementsByTagName("constellation"); 

	if (constellationData !== undefined)
	{
		for (var j=0; j<constellationData.length; j++)
		{
			var constellationData = constellationData[ j ];
			var constellationId = constellationData.attributes.getNamedItem("id").nodeValue;
			
			var instancesData = constellationData.getElementsByTagName("instance");

			if (instancesData !== undefined)
			{
				for (var u=0; u<instancesData.length; u++)
				{
					var instanceData = instancesData[ u ];
					var objectId = instanceData.attributes.getNamedItem("objectid").nodeValue;
			

					var deltaX = triangle.getElementsByTagName("deltax")[0].textContent;
					deltaX = parseFloat(deltaX);
					var deltaY = triangle.getElementsByTagName("deltay")[0].textContent;
					deltaY = parseFloat(deltaY);
					var deltaZ = triangle.getElementsByTagName("deltaz")[0].textContent;
					deltaZ = parseFloat(deltaZ);

					var rX = triangle.getElementsByTagName("rx")[0].textContent;
					rX = parseFloat(rX);
					var rY = triangle.getElementsByTagName("ry")[0].textContent;
					rY = parseFloat(rY);
					var rZ = triangle.getElementsByTagName("rz")[0].textContent;
					rZ = parseFloat(rZ);

					
				}
			}
		}
	}

	console.log( rootObj);
	return rootObj;
};



THREE.AMFLoader.prototype._parseXML = function (xmlStr) {

	//from http://stackoverflow.com/questions/649614/xml-parsing-of-a-variable-string-in-javascript
	var parseXml;

	if (typeof window.DOMParser != "undefined") {
	    parseXml = function(xmlStr) {
		return ( new window.DOMParser() ).parseFromString(xmlStr, "text/xml");
	    };
	} else if (typeof window.ActiveXObject != "undefined" &&
	       new window.ActiveXObject("Microsoft.XMLDOM")) {
	    parseXml = function(xmlStr) {
		var xmlDoc = new window.ActiveXObject("Microsoft.XMLDOM");
		xmlDoc.async = "false";
		xmlDoc.loadXML(xmlStr);
		return xmlDoc;
	    };
	} else {
	    throw new Error("No XML parser found");
	}

	return parseXml(xmlStr);

}

THREE.AMFLoader.prototype.parseASCII = function (data) {

	var geometry, length, normal, patternFace, patternNormal, patternVertex, result, text;
	geometry = new THREE.Geometry();
	patternFace = /facet([\s\S]*?)endfacet/g;

	while (((result = patternFace.exec(data)) != null)) {

		text = result[0];
		patternNormal = /normal[\s]+([\-+]?[0-9]+\.?[0-9]*([eE][\-+]?[0-9]+)?)+[\s]+([\-+]?[0-9]*\.?[0-9]+([eE][\-+]?[0-9]+)?)+[\s]+([\-+]?[0-9]*\.?[0-9]+([eE][\-+]?[0-9]+)?)+/g;

		while (((result = patternNormal.exec(text)) != null)) {

			normal = new THREE.Vector3(parseFloat(result[1]), parseFloat(result[3]), parseFloat(result[5]));

		}

		patternVertex = /vertex[\s]+([\-+]?[0-9]+\.?[0-9]*([eE][\-+]?[0-9]+)?)+[\s]+([\-+]?[0-9]*\.?[0-9]+([eE][\-+]?[0-9]+)?)+[\s]+([\-+]?[0-9]*\.?[0-9]+([eE][\-+]?[0-9]+)?)+/g;

		while (((result = patternVertex.exec(text)) != null)) {

			geometry.vertices.push(new THREE.Vector3(parseFloat(result[1]), parseFloat(result[3]), parseFloat(result[5])));

		}

		length = geometry.vertices.length;
		geometry.faces.push(new THREE.Face3(length - 3, length - 2, length - 1, normal));

	}

	geometry.computeCentroids();
	geometry.computeBoundingBox();
	geometry.computeBoundingSphere();

	return geometry;

};

THREE.EventDispatcher.prototype.apply( THREE.AMFLoader.prototype );

if ( typeof DataView === 'undefined'){

	DataView = function(buffer, byteOffset, byteLength){

		this.buffer = buffer;
		this.byteOffset = byteOffset || 0;
		this.byteLength = byteLength || buffer.byteLength || buffer.length;
		this._isString = typeof buffer === "string";

	}

	DataView.prototype = {

		_getCharCodes:function(buffer,start,length){
			start = start || 0;
			length = length || buffer.length;
			var end = start + length;
			var codes = [];
			for (var i = start; i < end; i++) {
				codes.push(buffer.charCodeAt(i) & 0xff);
			}
			return codes;
		},

		_getBytes: function (length, byteOffset, littleEndian) {

			var result;

			// Handle the lack of endianness
			if (littleEndian === undefined) {

				littleEndian = this._littleEndian;

			}

			// Handle the lack of byteOffset
			if (byteOffset === undefined) {

				byteOffset = this.byteOffset;

			} else {

				byteOffset = this.byteOffset + byteOffset;

			}

			if (length === undefined) {

				length = this.byteLength - byteOffset;

			}

			// Error Checking
			if (typeof byteOffset !== 'number') {

				throw new TypeError('DataView byteOffset is not a number');

			}

			if (length < 0 || byteOffset + length > this.byteLength) {

				throw new Error('DataView length or (byteOffset+length) value is out of bounds');

			}

			if (this.isString){

				result = this._getCharCodes(this.buffer, byteOffset, byteOffset + length);

			} else {

				result = this.buffer.slice(byteOffset, byteOffset + length);

			}

			if (!littleEndian && length > 1) {

				if (!(result instanceof Array)) {

					result = Array.prototype.slice.call(result);

				}

				result.reverse();
			}

			return result;

		},

		// Compatibility functions on a String Buffer

		getFloat64: function (byteOffset, littleEndian) {

			var b = this._getBytes(8, byteOffset, littleEndian),

				sign = 1 - (2 * (b[7] >> 7)),
				exponent = ((((b[7] << 1) & 0xff) << 3) | (b[6] >> 4)) - ((1 << 10) - 1),

			// Binary operators such as | and << operate on 32 bit values, using + and Math.pow(2) instead
				mantissa = ((b[6] & 0x0f) * Math.pow(2, 48)) + (b[5] * Math.pow(2, 40)) + (b[4] * Math.pow(2, 32)) +
							(b[3] * Math.pow(2, 24)) + (b[2] * Math.pow(2, 16)) + (b[1] * Math.pow(2, 8)) + b[0];

			if (exponent === 1024) {
				if (mantissa !== 0) {
					return NaN;
				} else {
					return sign * Infinity;
				}
			}

			if (exponent === -1023) { // Denormalized
				return sign * mantissa * Math.pow(2, -1022 - 52);
			}

			return sign * (1 + mantissa * Math.pow(2, -52)) * Math.pow(2, exponent);

		},

		getFloat32: function (byteOffset, littleEndian) {

			var b = this._getBytes(4, byteOffset, littleEndian),

				sign = 1 - (2 * (b[3] >> 7)),
				exponent = (((b[3] << 1) & 0xff) | (b[2] >> 7)) - 127,
				mantissa = ((b[2] & 0x7f) << 16) | (b[1] << 8) | b[0];

			if (exponent === 128) {
				if (mantissa !== 0) {
					return NaN;
				} else {
					return sign * Infinity;
				}
			}

			if (exponent === -127) { // Denormalized
				return sign * mantissa * Math.pow(2, -126 - 23);
			}

			return sign * (1 + mantissa * Math.pow(2, -23)) * Math.pow(2, exponent);
		},

		getInt32: function (byteOffset, littleEndian) {
			var b = this._getBytes(4, byteOffset, littleEndian);
			return (b[3] << 24) | (b[2] << 16) | (b[1] << 8) | b[0];
		},

		getUint32: function (byteOffset, littleEndian) {
			return this.getInt32(byteOffset, littleEndian) >>> 0;
		},

		getInt16: function (byteOffset, littleEndian) {
			return (this.getUint16(byteOffset, littleEndian) << 16) >> 16;
		},

		getUint16: function (byteOffset, littleEndian) {
			var b = this._getBytes(2, byteOffset, littleEndian);
			return (b[1] << 8) | b[0];
		},

		getInt8: function (byteOffset) {
			return (this.getUint8(byteOffset) << 24) >> 24;
		},

		getUint8: function (byteOffset) {
			return this._getBytes(1, byteOffset)[0];
		}

	 };
}



