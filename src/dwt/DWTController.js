import React , {useState , useEffect } from 'react';
import './DWTController.css';
import ValuePicker from './ValuePicker';
import RangePicker from './RangePicker';
/**
 * @props
 * @prop {object} Dynamsoft a namespace
 * @prop {number} startTime the time when initializing started
 * @prop {number} features the features that are enabled
 * @prop {WebTwain} dwt the object to perform the magic of Dynamic Web TWAIN
 * @prop {object} buffer the buffer status of data in memory (current & count)
 * @prop {number[]} selected the indices of the selected images
 * @prop {object[]} zones the zones on the current image that are selected by the user
 * @prop {object} runtimeInfo contains runtime information like the width & height of the current image
 * @prop {object[]} barcodeRects a number of rects to indicate where barcodes are found
 * @prop {function} handleOutPutMessage a function to call a message needs to be printed out
 * @prop {function} handleBarcodeResults a function to handle barcode rects
 * @prop {function} handleNavigating a function to handle whether navigation is allowed
 * @prop {function} handleException a function to handle exceptions
 */

 let initialShownTabs = 127;
 let cameraReady = false;
 let barcodeReady = false;
 let fileUploaderReady = false;
 let Dynamsoft = null;
 let DWTObject = null;
//  let dbrObject = null;
 let fileUploaderManager = null;
 let dbrResults = [];

export default function DWTController(props){

    if (props.features & 7 === 0) {
        initialShownTabs = props.features;
    } else {
        initialShownTabs = props.features & 1 || props.features & 2 || props.features & 4;
        if (props.features & 24) {
            initialShownTabs += 8;
        } else if (props.features & 96){
            initialShownTabs += 16;
        }
    }
    Dynamsoft = props.Dynamsoft
    const [shownTabs, setShownTabs] = useState(initialShownTabs);
    const [scanners, setScanners] = useState([]);
    const [deviceSetup, setDeviceSetup ] = useState({
        currentScanner: "Looking for devices..",
        currentCamera: "Looking for devices..",
        bShowUI: false,
        bADF: false,
        bDuplex: false,
        nPixelType: "0",
        nResolution: "100",
        isVideoOn: false
    });
    const [cameras, setCameras] = useState([]);
    const [cameraSettings, setCameraSettings] = useState([]);
    const [bShowRangePicker, setBShowRangePicker] = useState(false);
    const [rangePicker, setRangePicker] = useState({
        bCamera: false,
        value: 0,
        min: 0,
        max: 0,
        defaultvalue: 0,
        step: 0,
        title: ""
    });
    const [saveFileName, setSaveFileName] = useState((new Date()).getTime().toString());
    const [saveFileFormat, setSaveFileFormat] = useState("jpg");
    const [bUseFileUploader, setBUseFileUploader] = useState(false);
    const [bMulti, setBMulti] = useState(false);
    const [readingBarcode, setReadingBarcode] = useState(false);
    const [bWin] = useState(Dynamsoft.navInfo.bWin)

    const handleTabs = (event) => {
        if (event.keyCode && event.keyCode !== 32) return;
        event.target.blur();
        let nControlIndex = parseInt(event.target.getAttribute("controlindex"));
        (nControlIndex & 5) && toggleCameraVideo(false);
        if (shownTabs & nControlIndex) { //close a Tab
            setShownTabs(shownTabs - nControlIndex)
        } else { //Open a tab
            let _tabToShown = shownTabs;
            if (nControlIndex & 7) _tabToShown &= ~7;
            if (nControlIndex & 24) _tabToShown &= ~24;
            setShownTabs(_tabToShown + nControlIndex)
        }
    }
    useEffect(() => {
        DWTObject = props.dwt;
        if (DWTObject) {

            // from v19.0
            DWTObject.Addon.PDF.SetReaderOptions({
                convertMode: Dynamsoft.DWT.EnumDWT_ConvertMode.CM_RENDERALL,
                renderOptions: {
                    renderAnnotations: true,
                    resolution: 200
                },
                preserveUnmodifiedOnSave: true
            });

            DWTObject.Viewer.on("wheel", ()=>{
                props.handleBarcodeResults("clear");
            });
            DWTObject.Viewer.on("scroll", ()=>{
                props.handleBarcodeResults("clear");
            });
            
            if (props.features & 0b1) {
                DWTObject.GetDevicesAsync().then((devices)=>{
                    let sourceNames = [];
                    for (var i = 0; i < devices.length; i++) { // Get how many sources are installed in the system
                        sourceNames.push(devices[i].displayName);
                    }
                    setScanners(sourceNames);
                    if (sourceNames.length > 0) onSourceChange(sourceNames[0]);
                }).catch(function (exp) {
                    alert(exp.message);
                });
            }
            if (props.features & 0b10) {
                let cameraNames = DWTObject.Addon.Webcam.GetSourceList();
                setCameras(cameraNames)
                if (cameraNames.length > 0)
                    onCameraChange(cameraNames[0]);
            }
            if (props.features & 0b100000) {
                initBarcodeReader(props.features);
            }
            if (props.features & 0b1000000) {
                Dynamsoft.FileUploader.Init("", (objFileUploader) => {
                    fileUploaderManager = objFileUploader;
                    if (!fileUploaderReady) {
                        fileUploaderReady = true;
                        props.handleStatusChange(64);
                    }
                }, (errorCode, errorString) => {
                    props.handleException({ code: errorCode, message: errorString });
                    if (!fileUploaderReady) {
                        fileUploaderReady = true;
                        props.handleStatusChange(64);
                    }
                });
            }
        }
    },[props.dwt]) // eslint-disable-line react-hooks/exhaustive-deps
    
    // Tab 1: Scanner
    const onSourceChange = (value) => {
        setDeviceSetup({...deviceSetup,currentScanner:value})
        if (value === "noscanner") return;
        if (Dynamsoft.Lib.env.bMac) {
            if (value.indexOf("ICA") === 0) {
                setDeviceSetup({...deviceSetup,noUI:true})
            } else {
                setDeviceSetup({...deviceSetup,noUI:false})
            }
        }
    }
    const handleScannerSetupChange = (e, option) => {
        switch (option.substr(0, 1)) {
            default: break;
            case "b":
                onScannerSetupChange(option, e.target.checked);
                break;
            case "n":
                onScannerSetupChange(option, e.target.value);
                break;
        }
    }
    const onScannerSetupChange = (option, value) => {
        setDeviceSetup( deviceSetup => {
            let newDeviceSetup = {...deviceSetup};
            switch (option) {
                case "bShowUI":
                    newDeviceSetup.bShowUI = value;
                    break;
                case "bADF":
                    newDeviceSetup.bADF = value;
                    break;
                case "bDuplex":
                    newDeviceSetup.bDuplex = value;
                    break;
                case "nPixelType":
                    newDeviceSetup.nPixelType = value;
                    break;
                case "nResolution":
                    newDeviceSetup.nResolution = value;
                    break;
                default: break;
            }
            return newDeviceSetup
        })
    }
    const acquireImage = () => {
        DWTObject.GetDevicesAsync().then((devices) => {
            for (var i = 0; i < devices.length; i++) { // Get how many sources are installed in the system
                if (devices[i].displayName === deviceSetup.currentScanner) {
                    return devices[i];
                }
            }
        }).then((device) => {
            return DWTObject.SelectDeviceAsync(device);
        }).then(() => {
            return DWTObject.AcquireImageAsync({
                IfShowUI: deviceSetup.bShowUI,
                PixelType: deviceSetup.nPixelType,
                Resolution: deviceSetup.nResolution,
                IfFeederEnabled: deviceSetup.bADF,
                IfDuplexEnabled: deviceSetup.bDuplex,
                IfDisableSourceAfterAcquire: true,
                IfGetImageInfo: true,
                IfGetExtImageInfo: true,
                extendedImageInfoQueryLevel: 0
                /**
                 * NOTE: No errors are being logged!!
                 */
            });
        }).then(()=>{
            props.handleOutPutMessage("Acquire success!", "important")
        }).catch(function (exp) {
            props.handleOutPutMessage("Acquire failure!", "error")
        });
    }
    // Tab 2: Camera    
    const onCameraChange = (value) => {
        setDeviceSetup(deviceSetup => {
            let newDeviceSetup = {...deviceSetup};
            newDeviceSetup.currentCamera = value;
            return newDeviceSetup
        })
        if (value === "nocamera") {
            if (!cameraReady) {
                cameraReady = true;
                props.handleStatusChange(2);
            }
            return;
        }
        toggleCameraVideo(false);
        if (DWTObject.Addon.Webcam.SelectSource(value)) {
            let mediaTypes = DWTObject.Addon.Webcam.GetMediaType(),
                _mediaTypes = [],
                _currentmT = mediaTypes.GetCurrent();
            let frameRates = DWTObject.Addon.Webcam.GetFrameRate(),
                _frameRates = [],
                _currentfR = frameRates.GetCurrent();
            let resolutions = DWTObject.Addon.Webcam.GetResolution(),
                _resolutions = [],
                _currentRes = resolutions.GetCurrent();
            let _advancedSettings = [],
                _advancedCameraSettings = [];
            mediaTypes = mediaTypes._resultlist;
            frameRates = frameRates._resultlist;
            resolutions = resolutions._resultlist;
            for (let i = 0; i < mediaTypes.length - 1; i++) {
                mediaTypes[i] === _currentmT
                    ? _mediaTypes[i] = { value: mediaTypes[i].toString(), checked: true }
                    : _mediaTypes[i] = { value: mediaTypes[i].toString(), checked: false };
            }
            for (let i = 0; i < frameRates.length - 1; i++) {
                frameRates[i] === _currentfR
                    ? _frameRates[i] = { value: frameRates[i].toString(), checked: true }
                    : _frameRates[i] = { value: frameRates[i].toString(), checked: false };
            }
            for (let i = 0; i < resolutions.length - 1; i++) {
                resolutions[i] === _currentRes
                    ? _resolutions[i] = { value: resolutions[i].toString(), checked: true }
                    : _resolutions[i] = { value: resolutions[i].toString(), checked: false };
            }
            _advancedSettings = Object.keys(Dynamsoft.DWT.EnumDWT_VideoProperty).map((_value) => { return { value: _value.substr(3) } });
            _advancedCameraSettings = Object.keys(Dynamsoft.DWT.EnumDWT_CameraControlProperty).map((_value) => { return { value: _value.substr(4) } });
            setCameraSettings([{
                    name: "Media Type",
                    items: _mediaTypes
                }, {
                    name: "Frame Rate",
                    items: _frameRates
                }, {
                    name: "Resolution",
                    items: _resolutions
                }, {
                    name: "Video Setup",
                    items: _advancedSettings
                }, {
                    name: "Camera Setup",
                    items: _advancedCameraSettings
                }
            ]);
            if (!cameraReady) {
                cameraReady = true;
                props.handleStatusChange(2);
            }
        } else {
            props.handleException({
                code: -2,
                message: "Can't use the Webcam " + value + ", please make sure it's not in use!"
            });
            if (!cameraReady) {
                cameraReady = true;
                props.handleStatusChange(2);
            }
        }
    }
    const toggleShowVideo = () => {
        if (deviceSetup.isVideoOn === false) {
            toggleCameraVideo(true);
        } else {
            toggleCameraVideo(false);
        }
    }
    const toggleCameraVideo = (bShow) => {
        if (DWTObject) {
            if (bShow) {
                // clear barcode rects
                props.handleBarcodeResults("clear");
                
                playVideo();
                setDeviceSetup(deviceSetup => {
                    let newDeviceSetup = {...deviceSetup};
                    newDeviceSetup.isVideoOn = true;
                    return newDeviceSetup
                })
            } else {
                if(deviceSetup.isVideoOn) {
                    DWTObject.Addon.Webcam.StopVideo();
                    setDeviceSetup(deviceSetup => {
                        let newDeviceSetup = {...deviceSetup};
                        newDeviceSetup.isVideoOn = false;
                        return newDeviceSetup
                    })
                }
            }
        }
    }
    const playVideo = (config) => {
        let basicSetting, moreSetting;
        if (config) {
            if (config.prop === "Video Setup" || config.prop === "Camera Setup") {
                let bCamera = true;
                if (config.prop === "Video Setup") {
                    bCamera = false;
                    basicSetting = DWTObject.Addon.Webcam.GetVideoPropertySetting(Dynamsoft.DWT.EnumDWT_VideoProperty["VP_" + config.value]);
                    moreSetting = DWTObject.Addon.Webcam.GetVideoPropertyMoreSetting(Dynamsoft.DWT.EnumDWT_VideoProperty["VP_" + config.value]);
                } else {
                    basicSetting = DWTObject.Addon.Webcam.GetCameraControlPropertySetting(Dynamsoft.DWT.EnumDWT_CameraControlProperty["CCP_" + config.value]);
                    moreSetting = DWTObject.Addon.Webcam.GetCameraControlPropertyMoreSetting(Dynamsoft.DWT.EnumDWT_CameraControlProperty["CCP_" + config.value]);
                }
                let value = basicSetting.GetValue(),
                    min = moreSetting.GetMinValue(),
                    max = moreSetting.GetMaxValue(),
                    defaultvalue = moreSetting.GetDefaultValue();
                let bMutable = true;
                if (min === max && value === defaultvalue && min === value) {
                    bMutable = false;
                };
                setBShowRangePicker(true);
                setRangePicker({
                    bMutable: bMutable,
                    bCamera: bCamera,
                    value: value,
                    min: min,
                    max: max,
                    defaultvalue: defaultvalue,
                    step: moreSetting.GetSteppingDelta(),
                    title: config.value
                });
                return;
            } else {
                //this.DWTObject.Addon.Webcam.StopVideo();
                switch (config.prop) {
                    case "Frame Rate": DWTObject.Addon.Webcam.SetFrameRate(config.value); break;
                    case "Media Type": DWTObject.Addon.Webcam.SetMediaType(config.value); break;
                    case "Resolution": DWTObject.Addon.Webcam.SetResolution(config.value); break;
                    default: break;
                }
            }
        }
        /**
         * NOTE: The video playing is not smooth, there is a zoom-out effect (unwanted)
         */
        if ((config && deviceSetup.isVideoOn) || !config)
            DWTObject.Addon.Webcam.PlayVideo(DWTObject, 80, () => { });
    }
    const captureImage = () => {
        if (DWTObject) {
            let funCaptureImage = () => setTimeout(() => { toggleCameraVideo(false); }, 50);
            DWTObject.Addon.Webcam.CaptureImage(funCaptureImage, funCaptureImage);
        }
    }
    // Tab 3: Load
    const loadImagesOrPDFs = () => {
        DWTObject.IfShowFileDialog = true;
        DWTObject.LoadImageEx("", 5 /*this.Dynamsoft.DWT.EnumDWT_ImageType.IT_ALL*/, () => {
            props.handleOutPutMessage("Loaded an image successfully.");
        }, (errorCode, errorString) => props.handleException({ code: errorCode, message: errorString }));
    }
    // Tab 4: Save & Upload
    const handleFileNameChange = (event) => {
        setSaveFileName(event.target.value)
    }
    const handleSaveConfigChange = (event) => {
        let format = event.target.value;
        switch (format) {
            default: break;
            case "multiPage":
                setBMulti(event.target.checked); break;
            case "tif":
            case "pdf":{
                setSaveFileFormat(event.target.value);
                setBMulti(true);
                break;
            }
            case "bmp":
            case "jpg":
            case "png":{
                setSaveFileFormat(event.target.value);
                setBMulti(false);
                break;
            }
        }
    }
    const toggleUseUploade = (event) => {
        setBUseFileUploader(event.target.checked);
    }
    const saveOrUploadImage = (_type) => {
        if (_type !== "local" && _type !== "server") return;
        let fileName = saveFileName + "." + saveFileFormat;
        let imagesToUpload = [];
        let fileType = 0;
        let onSuccess = () => {
            setSaveFileName((new Date()).getTime().toString());
            _type === "local" ? props.handleOutPutMessage(fileName + " saved successfully!", "important") : props.handleOutPutMessage(fileName + " uploaded successfully!", "important");
        };
        let onFailure = (errorCode, errorString, httpResponse) => {
            (httpResponse && httpResponse !== "") ? props.handleOutPutMessage(httpResponse, "httpResponse") : props.handleException({ code: errorCode, message: errorString });
        };
        if (bMulti) {
            if (props.selected.length === 1 || props.selected.length === props.buffer.count) {
                if (_type === "local") {
                    switch (saveFileFormat) {
                        default: break;
                        case "tif": DWTObject.SaveAllAsMultiPageTIFF(fileName, onSuccess, onFailure); break;
                        case "pdf": DWTObject.SaveAllAsPDF(fileName, onSuccess, onFailure); break;
                    }
                }
                else {
                    for (let i = 0; i < props.buffer.count; i++)
                        imagesToUpload.push(i);
                }
            } else {
                if (_type === "local") {
                    switch (saveFileFormat) {
                        default: break;
                        case "tif": DWTObject.SaveSelectedImagesAsMultiPageTIFF(fileName, onSuccess, onFailure); break;
                        case "pdf": DWTObject.SaveSelectedImagesAsMultiPagePDF(fileName, onSuccess, onFailure); break;
                    }
                }
                else {
                    imagesToUpload = props.selected;
                }
            }
        } else {
            if (_type === "local") {
                switch (saveFileFormat) {
                    default: break;
                    case "bmp": DWTObject.SaveAsBMP(fileName, props.buffer.current, onSuccess, onFailure); break;
                    case "jpg": DWTObject.SaveAsJPEG(fileName, props.buffer.current, onSuccess, onFailure); break;
                    case "tif": DWTObject.SaveAsTIFF(fileName, props.buffer.current, onSuccess, onFailure); break;
                    case "png": DWTObject.SaveAsPNG(fileName, props.buffer.current, onSuccess, onFailure); break;
                    case "pdf": DWTObject.SaveAsPDF(fileName, props.buffer.current, onSuccess, onFailure); break;
                }
            }
            else {
                imagesToUpload.push(props.buffer.current);
            }
        }
        for (let o in Dynamsoft.DWT.EnumDWT_ImageType) {
            if (o.toLowerCase().indexOf(saveFileFormat) !== -1 && Dynamsoft.DWT.EnumDWT_ImageType[o] < 7) {
                fileType = Dynamsoft.DWT.EnumDWT_ImageType[o];
                break;
            }
        }
        if (_type === "server") {
            let protocol = Dynamsoft.Lib.detect.ssl ? "https://" : "http://"
            let _strPort = 2020;//for testing
            /*window.location.port === "" ? 80 : window.location.port;
            if (this.Dynamsoft.Lib.detect.ssl === true)
                _strPort = window.location.port === "" ? 443 : window.location.port;*/

            let strActionPage = "/upload";
            let serverUrl = protocol + window.location.hostname + ":" + _strPort + strActionPage;
            if (bUseFileUploader) {
                var job = fileUploaderManager.CreateJob();
                job.ServerUrl = serverUrl;
                job.FileName = fileName;
                job.ImageType = fileType;
                DWTObject.GenerateURLForUploadData(imagesToUpload, fileType, (resultURL, newIndices, enumImageType) => {
                    job.SourceValue.Add(resultURL, fileName);
                    job.OnUploadTransferPercentage = (job, sPercentage) => {
                        props.handleOutPutMessage("Uploading...(" + sPercentage + "%)");
                    };
                    job.OnRunSuccess = (job) => { onSuccess() };
                    job.OnRunFailure = (job, errorCode, errorString) => onFailure(errorCode, errorString);
                    fileUploaderManager.Run(job);
                }, (errorCode, errorString, strHTTPPostResponseString, newIndices, enumImageType) => {
                    props.handleException({ code: errorCode, message: errorString });
                });
            } else
                DWTObject.HTTPUpload(serverUrl, imagesToUpload, fileType, Dynamsoft.DWT.EnumDWT_UploadDataFormat.Binary, fileName, onSuccess, onFailure);
        }
    }
    // Tab 5: read Barcode
    const initBarcodeReader = (_features) => {
        DWTObject.Addon.BarcodeReader.getRuntimeSettings()
            .then(settings => {
                if (!barcodeReady) {
                    barcodeReady = true;
                    props.handleStatusChange(32);
                }
            }, (ex) => props.handleException({ code: -6, message: 'Initializing Barcode Reader failed: ' + (ex.message || ex) }));
    }
    const readBarcode = () => {

        let previewModeEl = document.querySelector('.previewMode');
        if (previewModeEl && previewModeEl.value !== "1") {
            props.handleOutPutMessage("Cannot read barcode in this view mode. Please switch to 1x1 view mode.", "error");
            return;
        }

        // close video
        toggleCameraVideo(false);
            
        Dynamsoft.Lib.showMask();
        props.handleBarcodeResults("clear");
        setReadingBarcode(true);
        props.handleNavigating(false);
        DWTObject.Viewer.gotoPage(DWTObject.CurrentImageIndexInBuffer);
        DWTObject.Addon.BarcodeReader.getRuntimeSettings()
            .then(settings => {
                if (DWTObject.GetImageBitDepth(props.buffer.current) === 1)
                    settings.scaleDownThreshold = 214748347;
                else
                    settings.scaleDownThreshold = 2300;
                settings.barcodeFormatIds = Dynamsoft.DBR.EnumBarcodeFormat.BF_ALL;
                settings.barcodeFormatIds_2 = Dynamsoft.DBR.EnumBarcodeFormat_2.BF2_DOTCODE + Dynamsoft.DBR.EnumBarcodeFormat_2.BF2_POSTALCODE;
                settings.region.measuredByPercentage = 0;
                if (props.zones.length > 0) {
                    let i = 0;
                    let readBarcodeFromRect = () => {
                        i++;
                        settings.region.left = props.zones[i].x;
                        settings.region.top = props.zones[i].y;
                        settings.region.right = props.zones[i].x + props.zones[i].width;
                        settings.region.bottom = props.zones[i].y + props.zones[i].height;
                        if (i === props.zones.length - 1)
                            doReadBarode(settings);
                        else
                            doReadBarode(settings, readBarcodeFromRect);
                    }
                    settings.region.left = props.zones[0].x;
                    settings.region.top = props.zones[0].y;
                    settings.region.right = props.zones[0].x + props.zones[0].width;
                    settings.region.bottom = props.zones[0].y + props.zones[0].height;
                    if (props.zones.length === 1)
                        doReadBarode(settings);
                    else
                        doReadBarode(settings, readBarcodeFromRect);
                }
                else {
                    settings.region.left = 0;
                    settings.region.top = 0;
                    settings.region.right = 0;
                    settings.region.bottom = 0;
                    doReadBarode(settings);
                }
            });
    }
    const doReadBarode = (settings, callback) => {
        let bHasCallback = Dynamsoft.Lib.isFunction(callback);
        DWTObject.Addon.BarcodeReader.updateRuntimeSettings(settings)
            .then(settings => {
                // Make sure the same image is on display
                let userData = props.runtimeInfo.curImageTimeStamp;
                let outputResults = () => {
                    if (dbrResults.length === 0) {
                        props.handleOutPutMessage("--------------------------", "seperator");
                        props.handleOutPutMessage("Nothing found on the image!", "important", false, false);
                        doneReadingBarcode();
                    } else {
                        props.handleOutPutMessage("--------------------------", "seperator");
                        props.handleOutPutMessage("Total barcode(s) found: " + dbrResults.length, "important");
                        for (let i = 0; i < dbrResults.length; ++i) {
                            let result = dbrResults[i];
                            props.handleOutPutMessage("------------------", "seperator");
                            props.handleOutPutMessage("Barcode " + (i + 1).toString());
                            props.handleOutPutMessage("Type: " + result.BarcodeFormatString);
                            props.handleOutPutMessage("Value: " + result.BarcodeText, "important");
                        }
                        if (props.runtimeInfo.curImageTimeStamp === userData) {
                            props.handleBarcodeResults("clear");
                            props.handleBarcodeResults(dbrResults);
                        }
                        doneReadingBarcode();
                    }
                };
                let onDbrReadSuccess = (results) => {
                    dbrResults = dbrResults.concat(results);
                    bHasCallback ? callback() : outputResults();
                };
                let onDbrReadFail = (_code, _msg) => {
                    props.handleException({
                        code: _code,
                        message: _msg
                    });
                    bHasCallback ? callback() : outputResults();
                };
                DWTObject.Addon.BarcodeReader.decode(props.buffer.current).then(onDbrReadSuccess, onDbrReadFail);
            });
    }

    const doneReadingBarcode = () => {
        props.handleNavigating(true);
        setReadingBarcode(false);
        dbrResults = [];
        Dynamsoft.Lib.hideMask();
    }
    const handleRangeChange = (event) => {
        let value = event.target.value ? event.target.value : event.target.getAttribute("value");
        if (value === "reset-range") {
            let prop = event.target.getAttribute("prop");
            let _type = event.target.getAttribute("_type");
            let _default = event.target.getAttribute("_default");
            setRangePicker({
                ...rangePicker,
                value:_default
            });
            _type === "camera"
                ? DWTObject.Addon.Webcam.SetCameraControlPropertySetting(Dynamsoft.DWT.EnumDWT_CameraControlProperty["CCP_" + prop], _default, true)
                : DWTObject.Addon.Webcam.SetVideoPropertySetting(Dynamsoft.DWT.EnumDWT_VideoProperty["VP_" + prop], _default, true);
            setBShowRangePicker(false);
        } else if (value === "close-picker") {
            setBShowRangePicker(false);
        } else {
            let _type = event.target.getAttribute("_type");
            let prop = event.target.getAttribute("prop");
            setRangePicker({
                ...rangePicker,
                value:value
            });
            _type === "camera"
                ? DWTObject.Addon.Webcam.SetCameraControlPropertySetting(Dynamsoft.DWT.EnumDWT_CameraControlProperty["CCP_" + prop], value, false)
                : DWTObject.Addon.Webcam.SetVideoPropertySetting(Dynamsoft.DWT.EnumDWT_VideoProperty["VP_" + prop], value, false);
        }
    }
    return (
        <div className="DWTController">
            <div className="divinput">
                <ul className="PCollapse">
                    {props.features & 0b1 ? (
                        <li> 
                            <div className="divType" tabIndex="1" controlindex="1" onKeyUp={(event) => handleTabs(event)} onClick={(event) => handleTabs(event)}>
                                <div className={shownTabs & 1 ? "mark_arrow expanded" : "mark_arrow collapsed"} ></div>
                                Custom Scan</div> 
                            <div className="divTableStyle" style={shownTabs & 1 ? { display: "block" } : { display: "none" }}>
                                <ul>
                                    <li>
                                        <select tabIndex="1" value={deviceSetup.currentScanner} className="fullWidth" onChange={(e) => onSourceChange(e.target.value)}>
                                            {
                                                scanners.length > 0 ?
                                                    scanners.map((_name, _index) =>
                                                        <option value={_name} key={_index}>{_name}</option>
                                                    )
                                                    :
                                                    <option value="noscanner">Looking for devices..</option>
                                            }
                                        </select>
                                    </li>
                                    <li>
                                        <ul>
                                            <li>
                                                {
                                                    deviceSetup.noUI ? "" : (
                                                        <label style={{ width: "32%", marginRight: "2%" }} ><input tabIndex="1" type="checkbox"
                                                            checked={deviceSetup.bShowUI}
                                                            onChange={(e) => handleScannerSetupChange(e, "bShowUI")}
                                                        />Show UI&nbsp;</label>
                                                    )
                                                }
                                                <label style={{ width: "32%", marginRight: "2%" }} ><input tabIndex="1" type="checkbox"
                                                    checked={deviceSetup.bADF}
                                                    onChange={(e) => handleScannerSetupChange(e, "bADF")}
                                                />Page Feeder&nbsp;</label>
                                                <label style={{ width: "32%" }}><input tabIndex="1" type="checkbox"
                                                    checked={deviceSetup.bDuplex}
                                                    onChange={(e) => handleScannerSetupChange(e, "bDuplex")}
                                                />Duplex</label>
                                            </li>
                                            <li>
                                                <select tabIndex="1" style={{ width: "48%", marginRight: "4%" }}
                                                    value={deviceSetup.nPixelType}
                                                    onChange={(e) => handleScannerSetupChange(e, "nPixelType")}>
                                                    <option value="0">B&amp;W</option>
                                                    <option value="1">Gray</option>
                                                    <option value="2">Color</option>
                                                </select>
                                                <select tabIndex="1" style={{ width: "48%" }}
                                                    value={deviceSetup.nResolution}
                                                    onChange={(e) => handleScannerSetupChange(e, "nResolution")}>
                                                    <option value="100">100 DPI</option>
                                                    <option value="200">200 DPI</option>
                                                    <option value="300">300 DPI</option>
                                                    <option value="600">600 DPI</option>
                                                </select>
                                            </li>
                                        </ul>
                                    </li>
                                    <li className="tc">
                                        <button tabIndex="1" className={scanners.length > 0 ? "majorButton enabled fullWidth" : "majorButton disabled fullWidth"} onClick={() => acquireImage()} disabled={scanners.length > 0 ? "" : "disabled"}>Scan</button>
                                    </li>
                                </ul>
                            </div>
                        </li>
                    ) : ""}
                    {bWin && (props.features & 0b10) ? (
                        <li>
                            <div className="divType" tabIndex="2" controlindex="2" onClick={(event) => handleTabs(event)} onKeyUp={(event) => handleTabs(event)}>
                                <div className={shownTabs & 2 ? "mark_arrow expanded" : "mark_arrow collapsed"} ></div>
                                Use Webcams</div>
                            <div className="divTableStyle" style={shownTabs & 2 ? { display: "block" } : { display: "none" }}>
                                <ul>
                                    <li>
                                        <select tabIndex="2" value={deviceSetup.currentCamera} className="fullWidth" onChange={(e) => onCameraChange(e.target.value)}>
                                            {
                                                cameras.length > 0 ?
                                                    cameras.map((_name, _index) =>
                                                        <option value={_index} key={_index}>{_name}</option>
                                                    )
                                                    :
                                                    <option value="nocamera">Looking for devices..</option>
                                            }
                                        </select>
                                        {cameraSettings.length > 0 ? (
                                            <ValuePicker
                                                tabIndex="2"
                                                targetObject={deviceSetup.currentCamera}
                                                valuePacks={cameraSettings}
                                                current={"Resolution"}
                                                handleValuePicking={(valuePair) => playVideo(valuePair)}
                                            />
                                        ) : ""}
                                    </li>
                                    <li className="tc">
                                        <button tabIndex="2" className="majorButton enabled width_48p" onClick={() => toggleShowVideo()}>{deviceSetup.isVideoOn ? "Hide Video" : "Show Video"}</button>
                                        <button tabIndex="2" className={deviceSetup.isVideoOn ? "majorButton enabled width_48p marginL_2p" : "majorButton disabled width_48p marginL_2p"} onClick={() => captureImage()} disabled={deviceSetup.isVideoOn ? "" : "disabled"} > Capture</button>
                                    </li>
                                </ul>
                            </div>
                        </li>
                    ) : ""}
                    {props.features & 0b100 ? (
                        <li>
                            <div className="divType" tabIndex="3" controlindex="4" onClick={(event) => handleTabs(event)} onKeyUp={(event) => handleTabs(event)}>
                                <div className={shownTabs & 4 ? "mark_arrow expanded" : "mark_arrow collapsed"} ></div>
                                Load Images or PDFs</div>
                            <div className="divTableStyle" style={shownTabs & 4 ? { display: "block" } : { display: "none" }}>
                                <ul>
                                    <li className="tc">
                                        <button tabIndex="3" className="majorButton enabled" onClick={() => loadImagesOrPDFs()} style={{ width: "100%" }}>Load</button>
                                    </li>
                                </ul>
                            </div>
                        </li>
                    ) : ""}
                    {(props.features & 0b1000) || (props.features & 0b10000) ? (
                        <li>
                            <div className="divType" tabIndex="4" controlindex="8" onClick={(event) => handleTabs(event)} onKeyUp={(event) => handleTabs(event)}>
                                <div className={shownTabs & 8 ? "mark_arrow expanded" : "mark_arrow collapsed"} ></div>
                                Save Documents</div>
                            <div className="divTableStyle div_SaveImages" style={shownTabs & 8 ? { display: "block" } : { display: "none" }}>
                                <ul>
                                    <li>
                                        <label className="fullWidth"><span style={{ width: "25%" }}>File Name:</span>
                                            <input tabIndex="4" style={{ width: "73%", marginLeft: "2%" }} type="text" size="20" value={saveFileName} onChange={(e) => handleFileNameChange(e)} /></label>
                                    </li>
                                    <li>
                                        <label><input tabIndex="4" type="radio" value="bmp" name="ImageType" onClick={(e) => handleSaveConfigChange(e)} />BMP</label>
                                        <label><input tabIndex="4" type="radio" value="jpg" name="ImageType" defaultChecked onClick={(e) => handleSaveConfigChange(e)} />JPEG</label>
                                        <label><input tabIndex="4" type="radio" value="tif" name="ImageType" onClick={(e) => handleSaveConfigChange(e)} />TIFF</label>
                                        <label><input tabIndex="4" type="radio" value="png" name="ImageType" onClick={(e) => handleSaveConfigChange(e)} />PNG</label>
                                        <label><input tabIndex="4" type="radio" value="pdf" name="ImageType" onClick={(e) => handleSaveConfigChange(e)} />PDF</label>
                                    </li>
                                    <li>
                                        <label><input tabIndex="4" type="checkbox"
                                            checked={(saveFileFormat === "pdf" || saveFileFormat === "tif") && (bMulti ? "checked" : "")}
                                            value="multiPage" disabled={(saveFileFormat === "pdf" || saveFileFormat === "tif") ? "" : "disabled"} onChange={(e) => handleSaveConfigChange(e)} />Upload Multiple Pages</label>
                                        {((props.features & 0b10000) && (props.features & 0b1000000))
                                            ? <label>
                                                <input tabIndex="4" title="Use Uploader" type="checkbox" onChange={(e) => toggleUseUploade(e)} />Use File Uploader</label>
                                            : ""}
                                    </li>
                                    <li className="tc">
                                        {(props.features & 0b1000) ? <button tabIndex="4" className={props.buffer.count === 0 ? "majorButton disabled width_48p" : "majorButton enabled width_48p"} disabled={props.buffer.count === 0 ? "disabled" : ""} onClick={() => saveOrUploadImage('local')} >Save to Local</button> : ""}
                                        {(props.features & 0b10000) ? <button tabIndex="4" className={props.buffer.count === 0 ? "majorButton disabled width_48p marginL_2p" : "majorButton enabled width_4p marginL_2p"} disabled={props.buffer.count === 0 ? "disabled" : ""} onClick={() => saveOrUploadImage('server')} >Upload to Server</button> : ""}
                                    </li>
                                </ul>
                            </div>
                        </li>
                    ) : ""}
                    {(props.features & 0b100000) ? (
                        <li>
                            <div className="divType" tabIndex="5" controlindex="16" onClick={(event) => handleTabs(event)} onKeyUp={(event) => handleTabs(event)}>
                                <div className={shownTabs & 16 ? "mark_arrow expanded" : "mark_arrow collapsed"} ></div>
                                Recognize</div>
                            <div className="divTableStyle" style={shownTabs & 16 ? { display: "block" } : { display: "none" }}>
                                <ul>
                                    <li className="tc">
                                        {(props.features & 0b100000) ? <button tabIndex="5" className={props.buffer.count === 0 ? "majorButton disabled width_48p" : "majorButton enabled width_48p"} disabled={props.buffer.count === 0 || readingBarcode ? "disabled" : ""} onClick={() => { readBarcode() } } >{readingBarcode ? "Reading..." : "Read Barcode"}</button> : ""}
                                    </li>
                                    {props.barcodeRects.length > 0 &&
                                        (<li><button tabIndex="5" className="majorButton enabled fullWidth" onClick={() => props.handleBarcodeResults("clear")}>Clear Barcode Rects</button></li>)
                                    }
                                </ul>
                            </div>
                        </li>
                    ) : ""}
                </ul>
            </div>
            {bShowRangePicker ? (
                <RangePicker tabIndex="2"
                    rangePicker={rangePicker}
                    handleRangeChange={(event) => handleRangeChange(event)}
                />
            ) : ""
            }
        </div >
    );
}