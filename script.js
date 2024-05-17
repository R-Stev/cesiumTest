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
  timeline: false
});
// To allow Cesium.js local resources in Chrome
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
          pitch : Cesium.Math.toRadians(eventData.beta - 90)
        }
      });
      oldOrientation = [eventData.alpha, eventData.beta, eventData.gamma];
      document.getElementById('compassImg').setAttribute('style', `transform: rotate(${Cesium.Math.toDegrees(-viewer.camera.heading)}deg);`);
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
        document.getElementById('compassImg').setAttribute('style', `transform: rotate(${Cesium.Math.toDegrees(-viewer.camera.heading)}deg);`);
      }
    } else {
      viewer.camera.rotateLeft(x);
      viewer.camera.rotateUp(y);
    }
  }
});


// API access and managing the satellite data
const getSatData = async () => {
  // const satelliteUrl = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle'
  // Using ~100 brightest satellites
  const satelliteUrl = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle'
  try {
    let response = await fetch(satelliteUrl, {method: 'GET'})
    if(response.ok){
      let textResponse = await response.text()
      return textResponse.split('\n')
    }
  } catch(err) {
    console.log(err)
  }
};

const parseGeo = (rawData, start, stop) => {
  let parsed = []

  // For each satellite,
  for(let i = 0; i < rawData.length - 1; i+=3){
    const satrec = satellite.twoline2satrec(rawData[i+1], rawData[i+2]);
    const positionsOverTime = new Cesium.SampledPositionProperty();
    // creates the sequence of positions over time.
    for(let i = 0; i < 9000; i+=10){
      const time = Cesium.JulianDate.addSeconds(start, i, new Cesium.JulianDate());
      const jsDate = Cesium.JulianDate.toDate(time);
      const positionAndVelocity = satellite.propagate(satrec, jsDate);
      const p = satellite.eciToGeodetic(positionAndVelocity.position, satellite.gstime(jsDate));
      const position = Cesium.Cartesian3.fromRadians(p.longitude, p.latitude, p.height * 1000);
      positionsOverTime.addSample(time, position);
    }
    parsed.push({
      "name": rawData[i],
      "id": rawData[i+1].substring(9, 16).trim(),
      "position": positionsOverTime,
      "point": { pixelSize: 10, color: Cesium.Color.RED }
    })
  }
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
  document.getElementById('compassImg').setAttribute('style', `transform: rotate(${Cesium.Math.toDegrees(-viewer.camera.heading)}deg);`);
  document.getElementById("compass").style.display = "block";
  flyToLocal(localCoord);
};

const setGlobalView = () => {
  flags.homeView = false;
  document.getElementById("compass").style.display = "none";
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
  const start = Cesium.JulianDate.fromDate(new Date());
  const stop = Cesium.JulianDate.addSeconds(start, 9000, new Cesium.JulianDate());
  viewer.clock.startTime = start.clone();
  viewer.clock.stopTime = stop.clone();
  viewer.clock.currentTime = start.clone();
  // viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
  try {
    const tileset = await Cesium.createGooglePhotorealistic3DTileset();
    viewer.scene.primitives.add(tileset);
  } catch (error) {
    console.log(`Failed to load tileset: ${error}`);
  } finally {
    viewer.clock.shouldAnimate = true;
    // Handles updating the coordinates in the selected satellite's description
    let updateDescription = setInterval(function() {
      if(viewer.selectedEntity){
        let p = Cesium.Cartographic.fromCartesian(viewer.selectedEntity.position.getValue(Cesium.JulianDate.fromDate(new Date())));
        viewer.selectedEntity.description = `Location: (${(p.latitude * Cesium.Math.DEGREES_PER_RADIAN).toFixed(2)}, ${(p.longitude * Cesium.Math.DEGREES_PER_RADIAN).toFixed(2)}, ${(p.height / 1000).toFixed()} km)`;
      }
    }, 500);
  }
  viewer.scene.screenSpaceCameraController.enableLook = false;
  viewer.scene.screenSpaceCameraController.enableRotate = false;
  viewer.scene.screenSpaceCameraController.enableTilt = false;
  viewer.scene.screenSpaceCameraController.enableTranslate = false;
  viewer.scene.screenSpaceCameraController.enableZoom = false;

  // Addition of the compass element, image sourced from https://pngimg.com/image/25581
  const cesiumViewer = document.getElementsByClassName("cesium-viewer")[0];
  const compassDiv = document.createElement("div");
  const compassImg = document.createElement("img");
  compassDiv.setAttribute('id', 'compass');
  compassImg.setAttribute('src', './images/compass.png');
  compassImg.setAttribute('id', 'compassImg');
  compassDiv.appendChild(compassImg);
  cesiumViewer.append(compassDiv);
  
  let satelliteData = await getSatData()
  const flightData = parseGeo(satelliteData, start, stop)
  cesiumSetup(flightData)
  // getGeolocation();
  setLocalPos({coords: {latitude: -34.918497, longitude: 138.598376}})
};

// CesiumJS initialisation
const cesiumSetup = (flightData) => {
    for (let i = 0; i < flightData.length; i++) {
        viewer.entities.add(flightData[i]);
    }
}

main()