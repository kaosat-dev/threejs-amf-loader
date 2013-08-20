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


THREE.AMFLoader = function () {
	this.defaultColor = new THREE.Color( "#cccccc" );
	this.defaultVertexNormal = new THREE.Vector3( 1, 1, 1 );
	this.recomputeNormals = true;
};

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

	//big question : should we be using something more like the COLLADA loader

	var xmlDoc = this._parseXML( data );
	var root = xmlDoc.documentElement;
	if( root.nodeName !== "amf")
	{
		throw("Unvalid AMF document, should have a root node called 'amf'");
	}

	
	return this._parseObjects(root);
	
};

THREE.AMFLoader.prototype._parseObjects = function ( root ){

	var objectsData = root.getElementsByTagName("object");
	
	var meshes = {};//temporary storage
	
	this.textures = this._parseTextures( root );
	this.materials = this._parseMaterials( root ); 
	
	
	for (var i=0; i< objectsData.length ; i++)
	{
		var objectData = objectsData[i];
		
		var objectId = objectData.attributes.getNamedItem("id").nodeValue;
		console.log("object id", objectId);
		
		var geometry = this._parseGeometries(objectData);
		var volumes = this._parseVolumes(objectData, geometry);
		
		///////////post process
		var currentGeometry = geometry["geom"];
		var volumeColor = new THREE.Color("#ffffff");
		var color = volumeColor !== null ? volumeColor : new THREE.Color("#ffffff");

		//console.log("color", color);
		var currentMaterial = new THREE.MeshLambertMaterial(
		{ 	color: color,
			vertexColors: THREE.VertexColors,
			shading: THREE.FlatShading
		} );
		
		//TODO: do this better
		if(Object.keys(this.textures).length>0)
		{
			var materialArray = [];
			for (var textureIndex in this.textures)
			{
				var texture = this.textures[textureIndex];
				materialArray.push(new THREE.MeshBasicMaterial({
					map: texture,
					color: color,
					vertexColors: THREE.VertexColors
					}));
			}
			console.log("bleh");
			currentMaterial = new THREE.MeshFaceMaterial(materialArray);
		}
		
		//currentMaterial = new THREE.MeshNormalMaterial();
		var currentMesh = new THREE.Mesh(currentGeometry, currentMaterial);
	
		if(this.recomputeNormals)
		{
			//TODO: only do this, if no normals were specified???
			currentGeometry.computeFaceNormals();
			currentGeometry.computeVertexNormals();
		}
		
		//add additional data to mesh
		var metadata = parseMetaData( objectData );
		console.log("meta", metadata);
		//add meta data to mesh
		if('name' in metadata)
		{
			currentMesh.name = metadata.name;
		}
		
		meshes[objectId] = currentMesh
	}
	
	
	return this._generateScene(root, meshes);
}


THREE.AMFLoader.prototype._parseGeometries = function (object){
	//get geometry data
	
	var attributes = {};
	
	attributes["position"] = [];
	attributes["normal"] = [];
	attributes["color"] = [];
	 
	var objectsHash = {}; //temporary storage of instances helper for amf
		var currentGeometry = new THREE.Geometry();		

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
				//get vertex data
				var vertexCoords = parseCoords( vertexData );
				var vertexNormals = parseNormals( vertexData , this.defaultVertexNormal);
				var vertexColor = parseColor( vertexData , this.defaultColor);
				
				attributes["position"].push(vertexCoords);
				attributes["normal"].push(vertexNormals);
				attributes["color"].push(vertexColor);
				
				currentGeometry.vertices.push(vertexCoords);
			}

			//get edges data , if any
			/* meh, kinda ugly spec to say the least
			var edgesList = vertice.getElementsByTagName("edge");
			for (var u=0; u<edgesList.length;u++)
			{
				var edgeData = edgesList[u];
			}*/
			
		}
	
	return {"geom":currentGeometry,"attributes":attributes};
}


THREE.AMFLoader.prototype._parseVolumes = function (meshData, geometryData){
	//get volumes data
	var currentGeometry = geometryData["geom"]
	//get material info
	
	//var materialId = meshData.attributes.getNamedItem("materialid").nodeValue;
	//console.log("material id",id);
	var volumesList = meshData.getElementsByTagName("volume");
	console.log("    volumes:",volumesList.length);
	
	for(var i=0; i<volumesList.length;i++)
	{
		var volumeData = volumesList[i];//meshData.getElementsByTagName("volume")[0]; 
	
		//var colorData = meshData.getElementsByTagName("color");
		var volumeColor = parseColor(volumeData);
		
		var materialId = volumeData.attributes.getNamedItem("materialid").nodeValue;
		var materialColor = this.materials[materialId].color;
		console.log("volumeMaterial",materialId,"color",materialColor);
		
		var trianglesList = volumeData.getElementsByTagName("triangle"); 
		for (var j=0; j<trianglesList.length; j++)
		{
			var triangle = trianglesList[j];
	
			//parse indices
			var v1 = parseTagText( triangle , "v1", "int");
			var v2 = parseTagText( triangle , "v2", "int");
			var v3 = parseTagText( triangle , "v3", "int");
			//console.log("v1,v2,v3,",v1,v2,v3);
			
			var colors = geometryData["attributes"]["color"];
			var vertexColors = [colors[v1],colors[v2],colors[v3]];
			
			//add vertex indices to current geometry
			//THREE.Face3 = function ( a, b, c, normal, color, materialIndex )
			//var faceColor = colorData
			
			var face = new THREE.Face3( v1, v2, v3 ) 
			currentGeometry.faces.push( face );
	
			var faceColor = parseColor(triangle);
			
			
			//TODO: fix ordering of color priorities
			//triangle/face coloring
			if (faceColor !== null)
			{
				//console.log("faceColor", faceColor);
				for( var v = 0; v < 3; v++ )  
				{
				    face.vertexColors[ v ] = faceColor;
				}
			}
			else if (volumeColor!=null)
			{
				//console.log("volume color", volumeColor);
				for( var v = 0; v < 3; v++ )  
				{
				    face.vertexColors[ v ] = volumeColor;
				}
			}//here object color
			else if (materialColor != null)
			{
				for( var v = 0; v < 3; v++ )  
				{
				    face.vertexColors[ v ] = materialColor;
				}
			}
			else
			{
				//console.log("vertexColors", vertexColors);
				face.vertexColors = vertexColors;
			}
						
			//normals
			var bla = geometryData["attributes"]["normal"];
			var vertexNormals = [bla[v1],bla[v2],bla[v3]];
			face.vertexNormals = vertexNormals;
			//console.log(vertexNormals);
			
			
			//get vertex UVs (optional)
			var mapping = triangle.getElementsByTagName("map")[0];
			if (mapping !== null && mapping !== undefined)
			{
				var rtexid = mapping.attributes.getNamedItem("rtexid").nodeValue;
				var gtexid = mapping.attributes.getNamedItem("gtexid").nodeValue;
				var btexid = mapping.attributes.getNamedItem("btexid").nodeValue;
				//console.log("textures", rtexid,gtexid,btexid);
				
				face.materialIndex  = rtexid;
				face.materialIndex  = 0;
				
				var u1 = mapping.getElementsByTagName("u1")[0].textContent;
				u1 = parseFloat(u1);
				var u2 = mapping.getElementsByTagName("u2")[0].textContent;
				u2 = parseFloat(u2);
				var u3 = mapping.getElementsByTagName("u3")[0].textContent;
				u3 = parseFloat(u3);
				
				var v1 = mapping.getElementsByTagName("v1")[0].textContent;
				v1 = parseFloat(v1);
				var v2 = mapping.getElementsByTagName("v2")[0].textContent;
				v2 = parseFloat(v2);
				var v3 = mapping.getElementsByTagName("v3")[0].textContent;
				v3 = parseFloat(v3);
				
				var uv1 = new THREE.Vector2(u1,v1);
				var uv2 = new THREE.Vector2(u2,v2);
				var uv3 = new THREE.Vector2(u3,v3);
				currentGeometry.faceVertexUvs[ 0 ].push( [uv1,uv2,uv3]);
				//currentGeometry.faceVertexUvs[ 0 ].push( [new THREE.Vector2(1,1),new THREE.Vector2(0,1),new THREE.Vector2(1,0)]);
				//this.threeMaterials = []
				//for (var i=0; i< textures.length;i++)
			}
		}
	}
}


THREE.AMFLoader.prototype._parseTextures = function ( node ){
	//get textures data
	var texturesData = node.getElementsByTagName("texture");
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
			rawImg = 'data:image/png;base64,'+window.btoa(rawImg);
			console.log(rawImg);
			
			//
			rawImg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAAB90RVh0U29mdHdhcmUATWFjcm9tZWRpYSBGaXJld29ya3MgOLVo0ngAAAAWdEVYdENyZWF0aW9uIFRpbWUAMDUvMjgvMTGdjbKfAAABwklEQVQ4jdXUsWrjQBCA4X+11spikXAEUWdSuUjh5goXx1V5snu4kMLgyoEUgYNDhUHGsiNbCK200hWXFI7iOIEUd9Mu87E7MzsC6PjCcL4S+z/AwXuHQgg8T6GUi+MI2rbDmJqqMnTd26U/CXqeRxD4aO2ilIOUAms7jGkpipr9vqSqqo+BnudxcaEZjRRx7DIeK7SWFIUlSQxpKhkMHLZbemgPFEIQBD6jkeL62mc2u2QyuSIMA/J8z+Pjb+bzNQ8P0DTtedDzFFq7xLHLbHbJzc0PptPv+H5EWWYsl3fALZvNirK05LnCGHMaVOpvzcZjxWRy9Yx9A2J8P2U6hSRJuL/fsFoZhsNjsDc2jiOQUqC1JAwDfD8CYkA/oxFhGKC1REqB44jj/Ndg23ZY21EUljzfU5YZkAIFkFKWGXm+pygs1nbUdXOUL4Gfr5vi+wohBFFk0VoQRQNcN6Msf7Fc3rFYLFksnsiymu22oG3b0zWsKkNR1KSpZD5fA7ckSdLrcprWHA6Gpjm+oeCNbXN+Dmt2O8N6/YS19jz4gp76KYeDYbc79LB3wZdQSjEcKhxHUNcNVVX3nvkp8LPx7+/DP92w3rYV8ocfAAAAAElFTkSuQmCC';
			
			image.src = rawImg;
			var texture = new THREE.Texture( image );
			texture.sourceFile = '';
			texture.needsUpdate = true;

			console.log("loaded texture");
			var textureId = textureData.attributes.getNamedItem("id").nodeValue;
			var textureType = textureData.attributes.getNamedItem("type").nodeValue;
			var textureTiling= textureData.attributes.getNamedItem("tiled").nodeValue
			textures[textureId] = texture;
		}
	}
	return textures;
}

THREE.AMFLoader.prototype._parseMaterials = function ( node ){
	
	var materialsData = node.getElementsByTagName("material");
	var materials = {};
	if (materialsData !== undefined)
	{
		for (var j=0; j<materialsData.length; j++)
		{
			var materialData = materialsData[ j ];
			var materialId = materialData.attributes.getNamedItem("id").nodeValue;
			var materialMeta = parseMetaData( materialData )
			var materialColor = parseColor(materialData);
			console.log("material id", materialId, "color",materialColor );
			materials[materialId] = {color:materialColor}
		}
	}
	return materials;
}


THREE.AMFLoader.prototype._parseConstellation = function ( root, meshes ){
	//parse constellation / scene data
	var constellationData = root.getElementsByTagName("constellation"); 
	var scene = null; 
	if (constellationData !== undefined && constellationData.length!==0)
	{
		scene = new THREE.Object3D();
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
			
					var position = parseVector3(instanceData, "delta");
					var rotation = parseVector3(instanceData, "r");
					console.log("target object",objectId, "position",position, "rotatation", rotation)
					
					var meshInstance = meshes[objectId].clone();
					meshInstance.position.add(position);
					
					meshInstance.rotation.set(rotation.x,rotation.y,rotation.z); 
					
					//we add current mesh to scene
					scene.add(meshInstance);
				}
			}
		}
	}
	return scene;
}

THREE.AMFLoader.prototype._generateScene = function(root, meshes){
	
	// if there is constellation data, don't just add meshes to the scene, but use 
	//the info from constellation to do so (additional transforms)
	var scene = this._parseConstellation( root, meshes );
	if (scene == null)
	{
		scene = new THREE.Object3D(); //storage of actual objects /meshes
		for (var meshIndex in meshes)
		{
			var mesh = meshes[meshIndex];
			scene.add( mesh );
		}
	}
	return scene;
}

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

THREE.EventDispatcher.prototype.apply( THREE.AMFLoader.prototype );

function parseMetaData( node )
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
		
		var value = node.getElementsByTagName(name)[0]
		

		if( value !== null && value !== undefined )
		{
			value=value.textContent;
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

	function parseColor( node , defaultValue)
	{
		var colorNode = node.getElementsByTagName("color")[0];//var color = volumeColor !== null ? volumeColor : new THREE.Color("#ffffff");
		var color = defaultValue || null;
		
		if (colorNode !== null && colorNode !== undefined)
		{
			if (colorNode.parentNode == node)
			{
			var r = parseTagText( node , "r", "float");
			var g = parseTagText( node , "g", "float");
			var b = parseTagText( node , "b", "float");
			var color = new THREE.Color().setRGB( r, g, b );
			}
		}	
		return color;
	}

	function parseVector3( node, prefix )
	{
		var coords = null;
		
		var x = parseTagText( node , prefix+"x", "float") || 0;
		var y = parseTagText( node , prefix+"y", "float") || 0;
		var z = parseTagText( node , prefix+"z", "float") || 0;
		var coords = new THREE.Vector3(x,y,z);
		return coords;
	}

	function parseCoords( node )
	{
		var coordinatesNode = node.getElementsByTagName("coordinates")[0];
		var coords = null;
		
		if (coordinatesNode !== null && coordinatesNode !== undefined)
		{
			if (coordinatesNode.parentNode == node)
			{
			var x = parseTagText( node , "x", "float");
			var y = parseTagText( node , "y", "float");
			var z = parseTagText( node , "z", "float");
			var coords = new THREE.Vector3(x,y,z);
			}
		}	
		return coords;
	}
	
	function parseNormals( node, defaultValue )
	{
		//get vertex normal data (optional)
		var normalsNode = node.getElementsByTagName("normal")[0];
		var normals = defaultValue || null;;
		
		if (normalsNode !== null && normalsNode !== undefined)
		{
			if (normalsNode.parentNode == node)
			{
			var x = parseTagText( node , "nx", "float");
			var y = parseTagText( node , "ny", "float");
			var z = parseTagText( node , "nz", "float");
			var normals = new THREE.Vector3(x,y,z);
			}
		}	
		return normals;
	}


