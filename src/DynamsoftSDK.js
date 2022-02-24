import React, { Suspense , useEffect, useState} from 'react';
import Dynamsoft from 'dwt';
const DWTUserInterface = React.lazy(() => import('./dwt/DWTUserInterface'));

let featureSet = { scan: 0b1, camera: 0b10, load: 0b100, save: 0b1000, upload: 0b10000, barcode: 0b100000, ocr: 0b1000000, uploader: 0b10000000 };
let features = 0b11111111;
let initialStatus = 0;
let DWObject = null;
let containerId = 'dwtcontrolContainer';
let width = 583;
let height = 513;

export default function DWT(props){

    if(props.features){
        features = 0;
        props.features.map((value) => {
            if (featureSet[value]) features += featureSet[value];
            return features;
        });
        initialStatus = 255 - (features & 0b11100011);
    }

    const [startTime] = useState((new Date()).getTime());
    const [unSupportedEnv, setUnSupportedEnv] = useState(false);
    const [dwt, setDwt] = useState(null);
    /** status
    * 0:  "Initializing..."
    * 1:  "Core Ready..." (scan)
    * 2:  "Camera Ready..."
    * 32: "BarcodeReader Ready..."
    * 64: "OCR engine Ready..."
    * 128:"Uploader Ready..."
    */
    const [status, setStatus] = useState(initialStatus);
    const [selected, setSelected] = useState([]);
    const [buffer, setBuffer] = useState({
        updated: false,
        count: 0,
        current: -1
    });
    const [zones, setZones] = useState([]);
    const [runtimeInfo, setRuntimeInfo] = useState({
        curImageTimeStamp: null,
        showAbleWidth: 0,
        showAbleHeight: 0,
        ImageWidth: 0,
        ImageHeight: 0
    })

    const modulizeInstallJS = () => {
        let _DWT_Reconnect = Dynamsoft.DWT_Reconnect;
        Dynamsoft.DWT_Reconnect = (...args) => _DWT_Reconnect.call({ Dynamsoft: Dynamsoft }, ...args);
        let __show_install_dialog = Dynamsoft._show_install_dialog;
        Dynamsoft._show_install_dialog = (...args) => __show_install_dialog.call({ Dynamsoft: Dynamsoft }, ...args);
        let _OnWebTwainOldPluginNotAllowedCallback = Dynamsoft.OnWebTwainOldPluginNotAllowedCallback;
        Dynamsoft.OnWebTwainOldPluginNotAllowedCallback = (...args) => _OnWebTwainOldPluginNotAllowedCallback.call({ Dynamsoft: Dynamsoft }, ...args);
        let _OnWebTwainNeedUpgradeCallback = Dynamsoft.OnWebTwainNeedUpgradeCallback;
        Dynamsoft.OnWebTwainNeedUpgradeCallback = (...args) => _OnWebTwainNeedUpgradeCallback.call({ Dynamsoft: Dynamsoft }, ...args);
        let _OnWebTwainPreExecuteCallback = Dynamsoft.OnWebTwainPreExecuteCallback;
        Dynamsoft.OnWebTwainPreExecuteCallback = (...args) => _OnWebTwainPreExecuteCallback.call({ Dynamsoft: Dynamsoft }, ...args);
        let _OnWebTwainPostExecuteCallback = Dynamsoft.OnWebTwainPostExecuteCallback;
        Dynamsoft.OnWebTwainPostExecuteCallback = (...args) => _OnWebTwainPostExecuteCallback.call({ Dynamsoft: Dynamsoft }, ...args);
        let _OnRemoteWebTwainNotFoundCallback = Dynamsoft.OnRemoteWebTwainNotFoundCallback;
        Dynamsoft.OnRemoteWebTwainNotFoundCallback = (...args) => _OnRemoteWebTwainNotFoundCallback.call({ Dynamsoft: Dynamsoft }, ...args);
        let _OnRemoteWebTwainNeedUpgradeCallback = Dynamsoft.OnRemoteWebTwainNeedUpgradeCallback;
        Dynamsoft.OnRemoteWebTwainNeedUpgradeCallback = (...args) => _OnRemoteWebTwainNeedUpgradeCallback.call({ Dynamsoft: Dynamsoft }, ...args);
        let _OnWebTWAINDllDownloadFailure = Dynamsoft.OnWebTWAINDllDownloadFailure;
        Dynamsoft.OnWebTWAINDllDownloadFailure = (...args) => _OnWebTWAINDllDownloadFailure.call({ Dynamsoft: Dynamsoft }, ...args);
    }
    
    const loadDWT = (UseService) => {
		Dynamsoft.DWT.Containers = [{ ContainerId: 'dwtcontrolContainer', Width: 270, Height: 350 }];
        Dynamsoft.DWT.ResourcesPath = "dwt-resources";
		Dynamsoft.DWT.ProductKey = 't00901wAAAFGokK55GCTHFf8RWZ8bKjNRD1O+Gf0xA6MUdkmYI6zSueLnBjy55bNxl/YW1HkZykS/h0xYHBuFFwIDbexR567425Cx3hnuwAewN5DyXtRd/ATLnyy+';
        let innerLoad = (UseService) => {
            innerLoadDWT(UseService)
                .then(
                    _DWObject => {
                        DWObject = _DWObject;
                        if (DWObject.Viewer.bind(document.getElementById(containerId))) {
							DWObject.Viewer.width = width;
							DWObject.Viewer.height = height;
                            DWObject.Viewer.setViewMode(1, 1);
							DWObject.Viewer.show();
                            handleStatusChange(1);
                            setDwt(DWObject)
                            // DWObject = dwt
                            if (DWObject) {
                                /**
                                 * NOTE: RemoveAll doesn't trigger bitmapchanged nor OnTopImageInTheViewChanged!!
                                 */
                                DWObject.RegisterEvent("OnBitmapChanged", (changedIndex, changeType) => handleBufferChange(changedIndex, changeType));
                                DWObject.Viewer.on("topPageChanged", (index, bByScrollBar) => { 
									if (bByScrollBar || DWObject.isUsingActiveX()){
										go(index);
									}
								});
                                DWObject.RegisterEvent("OnPostTransfer", () => handleBufferChange());
                                DWObject.RegisterEvent("OnPostLoad", () => handleBufferChange());
                                DWObject.RegisterEvent("OnPostAllTransfers", () => DWObject.CloseSource());
                                DWObject.Viewer.on('pageAreaSelected', (nImageIndex, rect) => {
                                    if (rect.length > 0) {
										let currentRect = rect[rect.length - 1];
										let newZones = [...zones];
										if(rect.length === 1)
											newZones = [];
										newZones.push({ x: currentRect.x, y: currentRect.y, width: currentRect.width, height: currentRect.height });
                                        setZones(newZones)
									}
                                });
                                DWObject.Viewer.on('pageAreaUnselected', () => setZones([]));
								DWObject.Viewer.on("click", () => { 
									handleBufferChange();
								});
                                if (Dynamsoft.Lib.env.bWin)
                                    DWObject.MouseShape = false;
                                handleBufferChange();
                            }
                        }
                    },
                    err => {
                        console.log(err);
                    }
                );
        };
        /**
        * ConnectToTheService is overwritten here for smoother install process.
        */
        Dynamsoft.DWT.ConnectToTheService = () => {
            innerLoad(UseService);
        };
        innerLoad(UseService);
    }

    //hook ----  componentdidmount
    useEffect(() => {
		Dynamsoft.Ready(function(){
			if (!Dynamsoft.Lib.env.bWin || !Dynamsoft.Lib.product.bChromeEdition) {
                setUnSupportedEnv(true)
				return;
			} else {
				if (DWObject === null){
                    loadDWT(true)
                }
			}
		});
    },[]); // eslint-disable-line react-hooks/exhaustive-deps
    
    // (handleBufferChange) callback
    useEffect(() => {
        if (buffer.count > 0) {
            setRuntimeInfo({
                curImageTimeStamp: (new Date()).getTime(),
                showAbleWidth: DWObject.HowManyImagesInBuffer > 1 ? width - 16 : width,
                showAbleHeight: height,
                ImageWidth: DWObject.GetImageWidth(buffer.current),
                ImageHeight: DWObject.GetImageHeight(buffer.current)
            })
        }
    },[buffer,buffer.count])

    const innerLoadDWT = (UseService) => {
        return new Promise((res, rej) => {
			if (UseService !== undefined)
				Dynamsoft.DWT.UseLocalService = UseService;
			modulizeInstallJS();
			let dwtInitialConfig = {
				WebTwainId: "dwtObject"
			};
			Dynamsoft.DWT.CreateDWTObjectEx(
				dwtInitialConfig,
				(_DWObject) => {
					res(_DWObject);
				},
				(errorString) => {
					rej(errorString)
				}
			);
        });
    }
    const go = (index) => {
        DWObject.CurrentImageIndexInBuffer = index;
        handleBufferChange();
    }
    const handleBufferChange = (changedIndex, changeType) => {
        let _updated = false;
        if (changeType === 4) {// Modified
            _updated = true;
        }
        let selection = DWObject.SelectedImagesIndices;
        setSelected(selection)
        setBuffer({
            updated: _updated,
            current: DWObject.CurrentImageIndexInBuffer,
            count: DWObject.HowManyImagesInBuffer
        })
    }

    const handleStatusChange = (value) => {
        setStatus(status => { return status + value})
    }
    const handleViewerSizeChange = (viewSize) => {
        width = viewSize.width;
        height = viewSize.height;
    }
    
    return(
        unSupportedEnv ? <div>Please use Chrome, Firefox or Edge on Windows!</div>
                : <div>
                    <Suspense fallback={<div>Loading...</div>}>
                        <DWTUserInterface
                            Dynamsoft={Dynamsoft}
                            features={features}
                            containerId={containerId}
                            startTime={startTime}
                            dwt={dwt}
                            status={status}
                            buffer={buffer}
                            selected={selected}
                            zones={zones}
                            runtimeInfo={runtimeInfo}
                            handleViewerSizeChange={(viewSize) => handleViewerSizeChange(viewSize)}
                            handleStatusChange={(value) => handleStatusChange(value)}
                            handleBufferChange={() => handleBufferChange()}
                        /></Suspense>
                </div>
    )
}