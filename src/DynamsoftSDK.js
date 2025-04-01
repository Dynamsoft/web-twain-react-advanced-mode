import React, { Suspense , useEffect, useState} from 'react';
import Dynamsoft from 'dwt';
const DWTUserInterface = React.lazy(() => import('./dwt/DWTUserInterface'));

let featureSet = { scan: 0b1, camera: 0b10, load: 0b100, save: 0b1000, upload: 0b10000, barcode: 0b100000, uploader: 0b1000000 };
let features = 0b1111111;
let initialStatus = 0;
let DWTObject = null;
let containerId = 'dwtcontrolContainer';
let width = 585;
let height = 513;

export default function DWT(props){

    if(props.features){
        features = 0;
        props.features.map((value) => {
            if (featureSet[value]) features += featureSet[value];
            return features;
        });
        initialStatus = features - (features & 0b1100011); //0b1110001
    }

    const [startTime] = useState((new Date()).getTime());
    const [unSupportedEnv] = useState(false);
    const [dwt, setDwt] = useState(null);
    /** status
    * 0:  "Initializing..."
    * 1:  "Core Ready..." (scan)
    * 2:  "Camera Ready..."
    * 32: "BarcodeReader Ready..."
    * 64:"Uploader Ready..."
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
        Dynamsoft.OnLicenseError = function (message, errorCode) {
            if(errorCode === -2808)
              message = '<div style="padding:0">Sorry. Your product key has expired. You can purchase a full license at the <a target="_blank" href="https://www.dynamsoft.com/store/dynamic-web-twain/#DynamicWebTWAIN">online store</a>.</div><div style="padding:0">Or, you can try requesting a new product key at <a target="_blank" href="https://www.dynamsoft.com/customer/license/trialLicense?product=dwt&utm_source=in-product">this page</a>.</div><div style="padding:0">If you need any help, please <a target="_blank" href="https://www.dynamsoft.com/company/contact/">contact us</a>.</div>';
              Dynamsoft.DWT.ShowMessage(message, {
              width: 680,
              headerStyle: 2
            });
         };
		Dynamsoft.DWT.Containers = [{ ContainerId: 'dwtcontrolContainer', Width: 270, Height: 350 }];
        Dynamsoft.DWT.ResourcesPath = "/dwt-resources";
		Dynamsoft.DWT.ProductKey = 'DLS2eyJvcmdhbml6YXRpb25JRCI6IjIwMDAwMSJ9';
        let innerLoad = (UseService) => {
            innerLoadDWT(UseService)
                .then(
                    _DWTObject => {
                        DWTObject = _DWTObject;
                        if (DWTObject.Viewer.bind(document.getElementById(containerId))) {
							DWTObject.Viewer.width = width;
							DWTObject.Viewer.height = height;
                            DWTObject.Viewer.setViewMode(1, 1);
                            DWTObject.Viewer.autoChangeIndex = true;
                            DWTObject.Viewer.show();
                            handleStatusChange(1);
                            setDwt(DWTObject)
                            // DWTObject = dwt
                            if (DWTObject) {
                                /**
                                 * NOTE: RemoveAll doesn't trigger bitmapchanged nor OnTopImageInTheViewChanged!!
                                 */
                                DWTObject.RegisterEvent("OnBitmapChanged", (changedIndex, changeType) => handleBufferChange(changedIndex, changeType));
                                DWTObject.Viewer.on("topPageChanged", (index, bByScrollBar) => { 
									if (bByScrollBar || DWTObject.isUsingActiveX()){
										go(index);
									}
								});
                                DWTObject.RegisterEvent("OnPostTransfer", () => handleBufferChange());
                                DWTObject.RegisterEvent("OnPostLoad", () => handleBufferChange());
                                DWTObject.RegisterEvent("OnBufferChanged", (e) => {
                                    if(e.action === 'shift' && e.currentId !==  -1){
                                        handleBufferChange()
                                    }
                                });
                                DWTObject.RegisterEvent("OnPostAllTransfers", () => DWTObject.CloseSource());
                                DWTObject.Viewer.on('pageAreaSelected', (nImageIndex, rect) => {
                                    if (rect.length > 0) {
										let currentRect = rect[rect.length - 1];
										let newZones = [...zones];
										if(rect.length === 1)
											newZones = [];
										newZones.push({ x: currentRect.x, y: currentRect.y, width: currentRect.width, height: currentRect.height });
                                        setZones(newZones)
									}
                                });
                                DWTObject.Viewer.on('pageAreaUnselected', () => setZones([]));
								DWTObject.Viewer.on("click", () => { 
									handleBufferChange();
								});
                                if (Dynamsoft.Lib.env.bWin)
                                    DWTObject.MouseShape = false;
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
                featureSet = { scan: 0b1, load: 0b100, save: 0b1000, upload: 0b10000, barcode: 0b100000, uploader: 0b1000000 };
                features = 0b1111101;
                initialStatus = 0;
                // setUnSupportedEnv(true)
				// return;
			} 
            
			if (DWTObject === null) loadDWT(true)
		});
    },[]); // eslint-disable-line react-hooks/exhaustive-deps
    
    // (handleBufferChange) callback
    useEffect(() => {
        setTimeout(()=>{
            if (buffer.count > 0) {
                setRuntimeInfo({
                    curImageTimeStamp: (new Date()).getTime(),
                    showAbleWidth: (DWTObject.HowManyImagesInBuffer > 1 ? width - 12 : width) - 4,
                    showAbleHeight: height - 4,
                    ImageWidth: DWTObject.GetImageWidth(buffer.current),
                    ImageHeight: DWTObject.GetImageHeight(buffer.current)
                })
            }
        }, 1)
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
				(_DWTObject) => {
					res(_DWTObject);
				},
				(errorString) => {
					rej(errorString)
				}
			);
        });
    }
    const go = (index) => {
        DWTObject.CurrentImageIndexInBuffer = index;
        handleBufferChange();
    }
    const handleBufferChange = (changedIndex, changeType) => {
        let _updated = false;
        if (changeType === 4) {// Modified
            _updated = true;
        }
        let selection = DWTObject.SelectedImagesIndices;
        setSelected(selection)
        setBuffer({
            updated: _updated,
            current: DWTObject.CurrentImageIndexInBuffer,
            count: DWTObject.HowManyImagesInBuffer
        })
    }

    const handleStatusChange = (value) => {
        setStatus(status => { return status + value})
    }
    const handleViewerSizeChange = (viewSize) => {
        //width = viewSize.width;
        //height = viewSize.height;
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