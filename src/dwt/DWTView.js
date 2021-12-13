import React,{useState , useEffect , useRef} from 'react';
import './DWTView.css';

/**
 * @props
 * @prop {WebTwain} dwt the object to perform the magic of Dynamic Web TWAIN
 * @prop {object} buffer the buffer status of data in memory (current & count)
 * @prop {object[]} zones the zones on the current image that are selected by the user
 * @prop {string} containerId the id of a DIV in which the view of Dynamic Web TWAIN will be built
 * @prop {object} runtimeInfo contains runtime information like the width & height of the current image
 * @prop {boolean} bNoNavigating whether navigation buttons will function (no if a time consuming operation like barcode reading is underway)
 * @prop {object[]} barcodeRects the rects that indicate where barcodes are found
 * @prop {function} handleBufferChange a function to call when the buffer may requires updating
 * @prop {function} handleOutPutMessage a function to call a message needs to be printed out
 */

 const re = /^\d+$/;
 let DWObject = null;
 let width = "583px"
 let height = "513px";
 let navigatorRight = "60px";
 let navigatorWidth = "585px";
 let imageEditor;

export default function DWTView(props){

    if (props.blocks !== undefined) {
        switch (props.blocks) {
            default: break;
            case 0: /** No navigate, no quick edit */
                width = "100%"; height = "100%"; break;
            case 1: /** No quick edit */
                width = "100%"; navigatorWidth = "100%"; navigatorRight = "0px"; break;
            case 2: /** No navigate */
                height = "100%"; break;
        }
    }
    const [viewReady, setViewReady] = useState(false);
    const [bShowChangeSizeUI, setBShowChangeSizeUI] = useState(false);
    const [newHeight, setNewHeight] = useState(props.runtimeInfo.ImageHeight);
    const [newWidth, setNewWidth] = useState(props.runtimeInfo.ImageWidth);
    const [InterpolationMethod, setInterpolationMethod] = useState("1");
    const [previewMode, setPreviewMode] = useState("1")

    const prevViewReady = usePrevious(viewReady)

    useEffect(() => {
        DWObject = props.dwt
        setViewReady({ viewReady: true })
    },[props.dwt])
    useEffect(() => {
        if(DWObject !==null && viewReady && !prevViewReady){
            DWObject.Viewer.width = width;
            DWObject.Viewer.height = height;
        }
        if(props.barcodeRects.length !== 0){
            !props.bNoNavigating && handlePreviewModeChange("1");
        }
        if (document.getElementById(props.containerId).offsetWidth !== 0) {
            props.handleViewerSizeChange({
                width: document.getElementById(props.containerId).offsetWidth,
                height: document.getElementById(props.containerId).offsetHeight
            });
        }
    })
    useEffect(() => {
        setNewHeight(props.runtimeInfo.ImageHeight)
    },[props.runtimeInfo.ImageHeight])
    useEffect(() => {
        setNewWidth(props.runtimeInfo.ImageWidth)
    },[props.runtimeInfo.ImageWidth])

    // Quick Edit
    const handleQuickEdit = (event) => {
        if (event.keyCode && event.keyCode !== 32) return;
        if (props.buffer.count === 0) {
            props.handleOutPutMessage("There is no image in Buffer!", "error");
            return;
        }
        if (props.bNoNavigating) {
            props.handleOutPutMessage("Navigation not allowed", "error");
            return;
        }
        switch (event.target.getAttribute("value")) {
            case "editor": imageEditor = DWObject.Viewer.createImageEditor(); imageEditor.show(); break;
            case "rotateL": DWObject.RotateLeft(props.buffer.current); break;
            case "rotateR": DWObject.RotateRight(props.buffer.current); break;
            case "rotate180": DWObject.Rotate(props.buffer.current, 180, true); break;
            case "mirror": DWObject.Mirror(props.buffer.current); break;
            case "flip": DWObject.Flip(props.buffer.current); break;
            case "removeS": DWObject.RemoveAllSelectedImages(); break;
            case "removeA": DWObject.RemoveAllImages(); handleNavigation("removeAll"); break;
            case "changeSize": setBShowChangeSizeUI(!bShowChangeSizeUI); break;
            case "crop": crop(); break;
            case "changeImageSizeOK": changeImageSizeOK(); break;
            default: break;
        }
    }
    const handleNewSize = (event, bHeight) => {
        if (!re.test(event.target.value)) {
            return;
        } else {
            if (bHeight)
                setNewHeight(event.target.value);
            else
                setNewWidth(event.target.value);
        }
    }
    const handleInterpolationMethodChange = (event) => {
        setInterpolationMethod(event.target.value)
    }
    const changeImageSizeOK = () => {
        DWObject.ChangeImageSize(props.buffer.current, newWidth, newHeight, parseInt(InterpolationMethod));
        setBShowChangeSizeUI(!bShowChangeSizeUI)
    }
    const crop = () => {
        if (props.zones.length === 0) {
            props.handleOutPutMessage("Please select where you want to crop first!", "error");
        } else if (props.zones.length > 1) {
            props.handleOutPutMessage("Please select only one rectangle to crop!", "error");
        } else {
            let _zone = props.zones[0];
            DWObject.Crop(
                props.buffer.current,
                _zone.x, _zone.y, _zone.x + _zone.width, _zone.y + _zone.height
            );
        }
    }
    const handleNavigation = (action) => {
        switch (action) {
            default://viewModeChange, removeAll
                break;
            case "first":
                DWObject.CurrentImageIndexInBuffer = 0; break;
            case "last":
                DWObject.CurrentImageIndexInBuffer = props.buffer.count - 1; break;
            case "previous":
                DWObject.CurrentImageIndexInBuffer = (props.buffer.current > 0) && (props.buffer.current - 1); break;
            case "next":
                DWObject.CurrentImageIndexInBuffer = (props.buffer.current < props.buffer.count - 1) && (props.buffer.current + 1); break;
        }
        props.handleBufferChange();
    }
    const handlePreviewModeChange = (event) => {
        let _newMode = "";
        if (event && event.target) {
            _newMode = event.target.value
        }
        else {
            if (parseInt(event) > 0 && (parseInt(event) < 6)) _newMode = parseInt(event).toString();
        }
        if (_newMode !== previewMode) {
            if (props.bNoNavigating) {
                console.log(props.barcodeRects.length);
                props.handleOutPutMessage("Navigation not allowed!", "error");
                return;
            }
            if (previewMode === "1" && props.barcodeRects.length > 0) {
                props.handleOutPutMessage("Can't change view mode when barcode rects are on display!", "error");
                return;
            }
            setPreviewMode(_newMode)
            DWObject.Viewer.setViewMode(parseInt(_newMode), parseInt(_newMode));
            DWObject.MouseShape = (parseInt(_newMode) > 1);
            handleNavigation("viewModeChange");
        }
    }
    return (
        <>
            <div style={{ display: viewReady ? "none" : "block" }} className="DWTcontainerTop"></div>
            <div style={{ display: viewReady ? "block" : "none" }} className="DWTcontainerTop">
                <div style={(props.blocks & 2 && viewReady) ? { display: "block" } : { display: "none" }} className="divEdit">
                    <ul className="operateGrp" onKeyUp={(event) => handleQuickEdit(event)} onClick={(event) => handleQuickEdit(event)}>
                        <li><img tabIndex="6" value="editor" src="Images/ShowEditor.png" title="Show Image Editor" alt="Show Editor" /> </li>
                        <li><img tabIndex="6" value="rotateL" src="Images/RotateLeft.png" title="Rotate Left" alt="Rotate Left" /> </li>
                        <li><img tabIndex="6" value="rotateR" src="Images/RotateRight.png" title="Rotate Right" alt="Rotate Right" /> </li>
                        <li><img tabIndex="6" value="rotate180" src="Images/Rotate180.png" title="Rotate 180" alt="Rotate 180" /> </li>
                        <li><img tabIndex="6" value="mirror" src="Images/Mirror.png" title="Mirror" alt="Mirror" /> </li>
                        <li><img tabIndex="6" value="flip" src="Images/Flip.png" title="Flip" alt="Flip" /> </li>
                        <li><img tabIndex="6" value="removeS" src="Images/RemoveSelectedImages.png" title="Remove Selected Images" alt="Remove Selected Images" /></li>
                        <li><img tabIndex="6" value="removeA" src="Images/RemoveAllImages.png" title="Remove All Images" alt="Remove All" /></li>
                        <li><img tabIndex="6" value="changeSize" src="Images/ChangeSize.png" title="Change Image Size" alt="Change Size" /> </li>
                        <li><img tabIndex="6" value="crop" src="Images/Crop.png" title="Crop" alt="Crop" /></li>
                    </ul>
                    <div className="ImgSizeEditor" style={bShowChangeSizeUI ? { visibility: "visible" } : { visibility: "hidden" }}>
                        <ul>
                            <li>
                                <label>New Height (pixel): <input tabIndex="6" type="text" value={newHeight} className="width_48p floatR" onChange={(event) => handleNewSize(event, true)} /></label>
                            </li>
                            <li>
                                <label>New Width (pixel): <input tabIndex="6" type="text" value={newWidth} className="width_48p floatR" onChange={(event) => handleNewSize(event)} /></label>
                            </li>
                            <li>Interpolation method:
                        <select tabIndex="6" value={InterpolationMethod} className="width_48p floatR" onChange={(event) => handleInterpolationMethodChange(event)}>
                                    <option value="1">NearestNeighbor</option><option value="2">Bilinear</option><option value="3">Bicubic</option></select>
                            </li>
                            <li style={{ textAlign: "center" }}>
                                <button tabIndex="6" className="width_48p floatL" value="changeImageSizeOK" onClick={(event) => handleQuickEdit(event)} >OK</button>
                                <button tabIndex="6" className="width_48p floatR" value="changeSize" onClick={(event) => handleQuickEdit(event)} >Cancel</button>
                            </li>
                        </ul>
                    </div>
                </div>
                <div style={{ position: "relative", float: "left", width: width, height: height }} id={props.containerId}>
                    {props.barcodeRects.map((_rect, _index) => (
                        <div key={_index} className="barcodeInfoRect" style={{ left: _rect.x + "px", top: _rect.y + "px", width: _rect.w + "px", height: _rect.h + "px" }} >
                            <div className="spanContainer"><span>[{_index + 1}]</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div style={(props.blocks & 1 && viewReady) ? { display: "block", width: navigatorWidth, left: navigatorRight } : { display: "none" }} className="navigatePanel clearfix">
                    <div className="ct-lt fullWidth tc floatL">
                        <button tabIndex="7" value="first" onClick={(event) => handleNavigation(event.target.value)}> |&lt; </button>
                    &nbsp;
                    <button tabIndex="7" value="previous" onClick={(event) => handleNavigation(event.target.value)}> &lt; </button>
                    &nbsp;&nbsp;&nbsp;&nbsp;
                    <input type="text" value={props.buffer.current > -1 ? props.buffer.current + 1 : ""} readOnly="readonly" />
                    /
                    <input type="text" value={props.buffer.count > 0 ? props.buffer.count : ""} readOnly="readonly" />
                    &nbsp;&nbsp;&nbsp;&nbsp;
                    <button tabIndex="7" value="next" onClick={(event) => handleNavigation(event.target.value)}> &gt; </button>
                    &nbsp;
                    <button tabIndex="7" value="last" onClick={(event) => handleNavigation(event.target.value)}> &gt;| </button>
                        <select tabIndex="7" className="previewMode" value={previewMode} onChange={(event) => handlePreviewModeChange(event)}>
                            <option value="1">1X1</option>
                            <option value="2">2X2</option>
                            <option value="3">3X3</option>
                            <option value="4">4X4</option>
                            <option value="5">5X5</option>
                        </select>
                    </div>
                </div>
            </div >
        </>
    );
}

function usePrevious(value){
    const ref = useRef();

    useEffect(() => {
        ref.current = value;
    },[value]);
    
    return ref.current;
}