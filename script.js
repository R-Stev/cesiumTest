Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmN2NiNWExOC1mMGE1LTRhZGQtYjQ0Ni00NGVmNTE1OTc2YTQiLCJpZCI6MTQwODA5LCJpYXQiOjE2ODQ4MzU1MDN9.lp2qQ6TJ95mGe2C1mH_TnU5vGUpw4-AdAVbE_nT0-1M';
let localCoord = [];
let oldOrientation = [0, 0, 0];
let startMousePosition;
let mousePosition;
const flags = {
  homeView: false,
  alignToDevice: false,
  looking: false,
  moveForward: false,
  moveBackward: false,
  moveUp: false,
  moveDown: false,
  moveLeft: false,
  moveRight: false,
};

const viewer = new Cesium.Viewer('cesiumContainer', {
  // animation: false,
  globe: false,
  geocoder: false,
  homeButton: false,
  navigationHelpButton: false,
  sceneModePicker: false,
});
viewer.infoBox.frame.setAttribute("sandbox", "allow-same-origin allow-popups allow-forms allow-scripts");
viewer.infoBox.frame.src = "about:blank";


// Returns true if orentation has changed by 1 degree or more
const sufficientChange = (change) => {
  const MinChange = 1;
  // console.log(change);
  for(let i in change){
    if(change[i] >= MinChange && 360 - change[i] >= MinChange) {
      return true;
    }
  }
  return false;
};

// Updates camera view using device orientation if eventData is valid & flags.homeView = true
function onDeviceOrientationChanged(eventData) {
  document.getElementById("heading").innerHTML = eventData.alpha.toFixed();
  document.getElementById("pitch").innerHTML = eventData.beta.toFixed();
  document.getElementById("roll").innerHTML = eventData.gamma.toFixed();
  // console.log(`${eventData.alpha} ${eventData.beta} ${eventData.gamma}`);
  // validOrientation = false if eventData has any null value
  let validOrientation = [eventData?.alpha, eventData?.beta, eventData?.gamma].some((x) => x == null) == false;
  if(flags.homeView && validOrientation) {
    flags.alignToDevice = true;
    let orientationChange = [
      Math.abs(eventData.alpha - oldOrientation[0]),
      Math.abs(eventData.beta - oldOrientation[1]),
      Math.abs(eventData.gamma - oldOrientation[2])
    ]
    if(sufficientChange(orientationChange)){
      viewer.camera.setView({
        orientation : {
          heading : Cesium.Math.toRadians(-eventData.alpha),
          pitch : Cesium.Math.toRadians(eventData.beta - 90),
          roll: Cesium.Math.toRadians(eventData.gamma)
        }
      });
      oldOrientation = [eventData.alpha, eventData.beta, eventData.gamma];
    }
  }
}

if (window.DeviceOrientationEvent) {
	window.addEventListener('deviceorientation', onDeviceOrientationChanged, false);
}

const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

handler.setInputAction(function (movement) {
  flags.looking = true;
  mousePosition = startMousePosition = Cesium.Cartesian3.clone(
    movement.position
  );
}, Cesium.ScreenSpaceEventType.LEFT_DOWN);

handler.setInputAction(function (movement) {
  mousePosition = movement.endPosition;
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

handler.setInputAction(function (position) {
  flags.looking = false;
}, Cesium.ScreenSpaceEventType.LEFT_UP);


viewer.clock.onTick.addEventListener(function (clock) {
  // document.getElementById("heading").innerHTML = viewer.camera.heading;
  // document.getElementById("pitch").innerHTML = viewer.camera.pitch;
  // document.getElementById("roll").innerHTML = viewer.camera.roll;
  if (flags.looking) {
    const width = viewer.canvas.clientWidth;
    const height = viewer.canvas.clientHeight;

    // Coordinate (0.0, 0.0) will be where the mouse was clicked.
    const lookFactor = 0.05;
    const x = (mousePosition.x - startMousePosition.x) * lookFactor / width;
    const y = -(mousePosition.y - startMousePosition.y) * lookFactor / height;

    if(flags.homeView){
      if(!flags.alignToDevice){
        viewer.camera.setView({
          orientation: {
            heading: viewer.camera.heading + x,
            pitch: viewer.camera.pitch + y
          }
        });
      }
    } else {
      viewer.camera.rotateLeft(x);
      viewer.camera.rotateUp(y);
    }
  }
});


// API access and managing the satellite data
const getSatData = async (satNum = '') => {
  const satelliteUrl = `https://api.spectator.earth/satellite/${satNum}`
  try {
    let response = await fetch(satelliteUrl, {method: 'GET'})
    if(response.ok){
      let jsonResponse = await response.json()
    //   console.log(jsonResponse)
      return satNum == '' ? jsonResponse.features : jsonResponse
    }
  } catch(err) {
    console.log(err)
  }
};

// API access and managing the satellite trajectory data
const getSatTrajectory = async (satNum) => {
  const satelliteUrl = `https://api.spectator.earth/satellite/${satNum}/trajectory`
  try {
      let response = await fetch(satelliteUrl, {method: 'GET'})
      if(response.ok){
        let jsonResponse = await response.json()
      //   console.log(jsonResponse)
        return jsonResponse
      }
    } catch(err) {
      console.log(err)
    }
};

const parseGeo = (rawData) => {
    let tempData = []
    let parsed = []
    // Filtering out the satellites that lack geometry data
    for(i in rawData){
        if(rawData[i].geometry){
            tempData.push(rawData[i])
        }
    }
    for(i in tempData){
        parsed.push({
            "name": tempData[i].properties.name,
            "id": tempData[i].id,
            "longitude": tempData[i].geometry.coordinates[0],
            "latitude": tempData[i].geometry.coordinates[1]
        })
    }
    // console.log(rawData)
    return parsed
};

const setLocalPos = (pos) => {
  localCoord = pos.coords;
  // console.log("Your current position is:");
  // console.log(`Latitude : ${localCoord.latitude}`);
  // console.log(`Longitude: ${localCoord.longitude}`);
  setLocalView();
  setGeolocContent('Done');
};

const setLocalView = () => {
  flags.homeView = true;
  flyToLocal(localCoord);
};

const setGlobalView = () => {
  flags.homeView = false;
  viewer.camera.flyHome()
};

const flyToLocal = (localCoord) => {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(localCoord.longitude, localCoord.latitude, 25.0),
    orientation: {pitch: Cesium.Math.toRadians(5.0),}
  });
};

function posError(err) {
  console.warn(`ERROR(${err.code}): ${err.message}`);
  setGeolocContent('Fail');
};

const posOptions = {
  enableHighAccuracy: true,
  maximumAge: 30000,
  timeout: 27000,
};

const setGeolocContent = (status) => {
  document.getElementById('geoDotLoad').style.display = 'none';
  document.getElementById(`geoDot${status}`).style.display = 'inline-block';
  document.getElementById('geoBtnLoad').style.display = 'none';
  document.getElementById(`geoBtn${status}`).style.display = 'inline-block';
  // console.log(`inner: ${inner}`)
};

const getGeolocation = () => {
  if("geolocation" in navigator){
      document.getElementById('geoDotLoad').style.display = 'inline-block';
      document.getElementById(`geoDotFail`).style.display = 'none';
      document.getElementById(`geoDotDone`).style.display = 'none';
      document.getElementById('geoBtnLoad').style.display = 'inline-block';
      document.getElementById(`geoBtnFail`).style.display = 'none';
      document.getElementById(`geoBtnDone`).style.display = 'none';
      navigator.geolocation.getCurrentPosition(setLocalPos, posError, posOptions)
  }
};

const main = async () => {
  try {
    const tileset = await Cesium.createGooglePhotorealistic3DTileset();
    viewer.scene.primitives.add(tileset);
  } catch (error) {
    console.log(`Failed to load tileset: ${error}`);
  }
  viewer.scene.screenSpaceCameraController.enableLook = false;
  viewer.scene.screenSpaceCameraController.enableRotate = false;
  viewer.scene.screenSpaceCameraController.enableTilt = false;
  viewer.scene.screenSpaceCameraController.enableTranslate = false;
  viewer.scene.screenSpaceCameraController.enableZoom = false;
  
  let satelliteData = await getSatData()
  // console.log(satelliteData[11].geometry)
  const flightData = parseGeo(satelliteData)
  // let satTrajectory = await getSatTrajectory(615)
  // console.log(satTrajectory)
  cesiumSetup(flightData)
  // getGeolocation();
  setLocalPos({coords: {latitude: -34.918497, longitude: 138.598376}})
};

// CesiumJS initialisation
const cesiumSetup = (flightData) => {
    for (let i = 0; i < flightData.length; i++) {
        const dataPoint = flightData[i];

        viewer.entities.add({
            name: dataPoint.name,
            description: `Location: (${dataPoint.longitude}, ${dataPoint.latitude})`,
            // description: `Location: (${dataPoint.longitude}, ${dataPoint.latitude}, ${dataPoint.height})`,
            // api.spectator.earth does not include altitudes, using 1000km for now
            position: Cesium.Cartesian3.fromDegrees(dataPoint.longitude, dataPoint.latitude, 1000000),
            point: { pixelSize: 10, color: Cesium.Color.RED }
        });
    }
}

main()