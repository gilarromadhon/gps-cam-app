import { Ionicons } from '@expo/vector-icons';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { Button, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import ViewShot from 'react-native-view-shot';

type LocationCoords = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
};

type weatherDesc = {
  desc: number;
  temp: number;
};

type CameraRef = {
  takePictureAsync: () => Promise<{ uri: string }>;
};

export default function App() {
  const cameraRef = useRef<any>(null);
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [timestamp, setTimestamp] = useState<string | null>(null);
  const [weatherInfo, setWeatherInfo] = useState<weatherDesc | null>({});
  const viewShotRef = useRef<ViewShot>(null);

  useEffect(() => {
    (async () => {
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      
      setLocationPermission(locationStatus === 'granted');
    })();
  }, []);

  if (locationPermission === null || locationPermission === false) {
    return (
      <View style={styles.containerAlert}>
        <Text style={styles.message}>Tidak ada akses ke lokasi</Text>
        <Text style={styles.message}>Silakan berikan izin melalui pengaturan perangkat</Text>
      </View>
    );
  }

  if (!permission || !permission.granted) {
    return (
      <View style={styles.containerAlert}>
        <Text style={styles.message}>Tidak ada akses ke kamera</Text>
        <Text style={styles.message}>Silakan berikan izin melalui pengaturan perangkat</Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  const getCurrentLocation = async () => {
    try {
      let location = await Location.getCurrentPositionAsync({});
      setLocation(location.coords);
      console.log('Lokasi:', location.coords);
    } catch (error) {
      alert('Gagal mendapatkan lokasi');
      console.error('Error location:', error);
    }
  };

  const requestLocationPermission = async (): Promise<void> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      setLocationPermission(status === 'granted');
      
      if (status === 'granted') {
        await getCurrentLocation();
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
    }
  };
  
  const takePicture = async (): Promise<void> => {
    if (cameraRef.current) {
      try {
        if (locationPermission === null) {
          await requestLocationPermission();
        } else if (locationPermission === true) {
          await getCurrentLocation();
        }

        const weatherResponse = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${location?.latitude}&lon=${location?.longitude}&appid=d9aee9ab291519f449c07860c8688539&units=metric`
        );
        const weatherJson = await weatherResponse.json();

        console.log(weatherJson)

        const weatherDesc = weatherJson.weather[0].description;
        const temp = weatherJson.main.temp;

        setWeatherInfo({ desc: weatherDesc, temp });

        const photo = await cameraRef.current.takePictureAsync({ exif: true });

        const currentTime = new Date();
        const formattedTime = currentTime.toLocaleString();
        setCapturedImage(photo.uri);
        setTimestamp(formattedTime);

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });

        if (loc.mocked || (loc.coords && (loc.coords as any).isMocked)) {
          alert('Aplikasi pendeteksi lokasi palsu terdeteksi di perangkat ini. Matikan fake GPS sebelum melanjutkan.');
          return;
        }
        
        if (location) {
          const result = await ImageManipulator.manipulateAsync(
            photo.uri,
            [],
            {
              compress: 1,
              format: ImageManipulator.SaveFormat.JPEG,
              exif: {
                ...photo.exif,
                GPSLatitude: location.latitude,
                GPSLongitude: location.longitude,
                GPSLatitudeRef: location.latitude >= 0 ? 'N' : 'S',
                GPSLongitudeRef: location.longitude >= 0 ? 'E' : 'W',
                DateTimeOriginal: currentTime.toISOString(),
                Software: 'GPS-CAM App',
              },
            }
          );

          setCapturedImage(result.uri);
        }

      } catch (error) {
        alert('Gagal mengambil foto');
        console.error('Error camera:', error);
      }
    }
  };


  const retakePicture = (): void => {
    setCapturedImage(null);
    setTimestamp(null);
  };

  return (
    <View style={styles.container}>
      {!capturedImage ? (
        <View style={styles.previewContainer}>
          <CameraView style={styles.camera} facing={facing} ref={cameraRef} />
          <View style={styles.watermarkOverlay}>
            <Image source={require('../../assets/images/react-logo.png')} style={styles.watermarkImage} />
          </View>
        </View>
      ) : (
        <ViewShot
          ref={viewShotRef}
          style={styles.previewContainer}
          options={{ format: 'jpg', quality: 0.9 }}
        >
          <Image source={{ uri: capturedImage }} style={styles.previewImage} />
          <View style={styles.watermarkOverlay}>
            <Image source={require('../../assets/images/react-logo.png')} style={styles.watermarkImage} />
          </View>
          <View style={styles.watermarkBox}>

            <Text style={styles.watermarkText}>
              🕒 {timestamp} WIB
            </Text>

            {location && (
              <Text style={styles.watermarkText}>
                📍 {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              </Text>
            )}

            {weatherInfo && (
              <Text style={styles.watermarkText}>
                ☁️ {weatherInfo.desc}, {weatherInfo.temp.toFixed(1)}°C
              </Text>
            )}

            {location && (
              <MapView
                style={styles.miniMap}
                region={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                  latitudeDelta: 0.002,
                  longitudeDelta: 0.002,
                }}
                pitchEnabled={false}
                rotateEnabled={false}
                scrollEnabled={false}
                zoomEnabled={false}
              >
                <Marker coordinate={{ latitude: location.latitude, longitude: location.longitude }} />
              </MapView>
            )}
          </View>
        </ViewShot>
      )}

      <View style={styles.controls}>
        {!capturedImage ? (
          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
              <Ionicons name="camera-reverse" size={36} color="white" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
            
            <View style={styles.placeholder} />
          </View>
        ) : (
          <View style={styles.previewControls}>
            <TouchableOpacity style={styles.button} onPress={retakePicture}>
              <Text style={styles.buttonText}>Ambil Ulang</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  containerAlert: {
    flex: 1,
    backgroundColor: '#000',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  },
  camera: {
    flex: 1,
  },
  previewContainer: {
    marginTop: 50,
    flex: 1,
    backgroundColor: '#000',
  },
  previewImage: {
    flex: 1,
  },
  controls: {
    padding: 20,
    alignItems: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: 'black',
  },
  previewControls: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignContent: 'center',
    width: '40%',
    height: 80
  },
  button: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    minWidth: 120,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center'
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    color: 'white'
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 64,
    flexDirection: 'column',
    backgroundColor: 'transparent',
    width: '100%',
    paddingHorizontal: 64,
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    height: 80
  },
  flipButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 12,
    borderRadius: 10,
    minWidth: 70,
  },
  placeholder: {
    width: 70,
  },
  watermarkLiveContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  watermarkLive: {
    width: 100,
    height: 100,
    opacity: 0.2,
  },
  watermarkOverlay: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  watermarkImage: {
    width: 100,
    height: 100,
    opacity: 0.2,
  },
  watermarkBox: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    padding: 10,
    borderRadius: 12,
    width: '50%'
  },
  logo: {
    width: 80,
    height: 30,
    resizeMode: 'contain',
    alignSelf: 'flex-end',
    marginBottom: 5,
  },
  watermarkText: {
    color: 'white',
    fontSize: 14,
    marginVertical: 2,
  },
  miniMap: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginTop: 6,
  },
});