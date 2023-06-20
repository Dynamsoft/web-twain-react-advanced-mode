import React, { Suspense , useEffect, useState , useRef} from 'react';
import './DWTUserInterface.css';
import DWTOutPut from './DWTOutPut';
import DWTView from './DWTView';
const DWTController = React.lazy(() => import('./DWTController'));

/**
 * @props
 * @prop {object} Dynamsoft a namespace
 * @prop {number} features the features that are enabled
 * @prop {string} containerId the id of a DIV in which the view of Dynamic Web TWAIN will be built
 * @prop {number} startTime the time when initializing started
 * @prop {WebTwain} dwt the object to perform the magic of Dynamic Web TWAIN
 * @prop {string} status a message to indicate the status of the application
 * @prop {object} buffer the buffer status of data in memory (current & count)
 * @prop {number[]} selected the indices of the selected images
 * @prop {object[]} zones the zones on the current image that are selected by the user
 * @prop {object} runtimeInfo contains runtime information like the width & height of the current image 
 * @prop {function} handleBufferChange a function to call when the buffer may requires updating
 */
export default function DWTUserInterface(props){

    const statusChangeText = (_status,_statusChange) => {   
        let text = "Initializing...";
        if (_statusChange) {
            text = [];
            (_statusChange & 1) && text.push("Core module ");
            (_statusChange & 2) && text.push("Webcam module ");
            (_statusChange & 32) && text.push("Barcode Reader module ");
            (_statusChange & 64) && text.push("OCR module ");
            (_statusChange & 128) && text.push("File Uploader module ");
            if (text.length > 1)
                text = text.join(" & ");
            text += "ready...";
        }
        if (_status === props.features) {
            if (_statusChange)
                text = "_ALLDONE_" + text;
            else
                text = "Ready...";
        }
        return text;
    }
    
    const [messages, setMessages] = useState([{
        time:(new Date()).getTime(),
        text:statusChangeText(props.status),
        type:"info"
    }]);
    const [bNoScroll, setBNoScroll] = useState(false);
    const [bNoNavigating, setBNoNavigating] = useState(false);
    const [barcodeRects, setBarcodeRects] = useState([]);
    const prevProps = usePrevious(props);
    //Skip first render
    const overMount = useRef(false)

    useEffect(() => {
        if(!overMount.current){
            overMount.current = true;
            return;
        }
        if (prevProps.status !== props.status) {
            let _statusChange = props.status - prevProps.status;
            let _text = statusChangeText(props.status, _statusChange);
            if (_text.indexOf("_ALLDONE_") !== -1) {
                handleOutPutMessage(_text.substr(9));
                handleOutPutMessage("All ready... <initialization took " + ((new Date()).getTime() - props.startTime) + " milliseconds>", "important");
            } else
                handleOutPutMessage(_text);
        }
        if ((prevProps.buffer.current !== props.buffer.current) || props.buffer.updated) {
            barcodeRects.length > 0 && handleBarcodeResults("clear");
            props.buffer.updated && props.handleBufferChange();
        }
    })

    const handleBarcodeResults = (results) => {
        if (results === "clear")
            setBarcodeRects([]);
        else {
            let _oldBR = [...barcodeRects];
            if (results.length > 0) {
                let zoom;
                if (props.runtimeInfo.showAbleWidth >= props.runtimeInfo.ImageWidth && props.runtimeInfo.showAbleHeight >= props.runtimeInfo.ImageHeight) {
                    zoom = 1;
                } else if (props.runtimeInfo.showAbleWidth / props.runtimeInfo.showAbleHeight >= props.runtimeInfo.ImageWidth / props.runtimeInfo.ImageHeight) {
                    zoom = props.runtimeInfo.showAbleHeight / props.runtimeInfo.ImageHeight;
                } else {
                    zoom = props.runtimeInfo.showAbleWidth / props.runtimeInfo.ImageWidth;
                }
                for (let i = 0; i < results.length; ++i) {
                    let result = results[i];
                    let loc = result.localizationResult;
                    let left = Math.min(loc.x1, loc.x2, loc.x3, loc.x4);
                    let top = Math.min(loc.y1, loc.y2, loc.y3, loc.y4);
                    let right = Math.max(loc.x1, loc.x2, loc.x3, loc.x4);
                    let bottom = Math.max(loc.y1, loc.y2, loc.y3, loc.y4);
                    let leftBase = 1 + props.runtimeInfo.showAbleWidth / 2 - props.runtimeInfo.ImageWidth / 2 * zoom;
                    let topBase = 2 + props.runtimeInfo.showAbleHeight / 2 - props.runtimeInfo.ImageHeight / 2 * zoom;
                    let width = (right - left) * zoom;
                    let height = (bottom - top) * zoom;
                    left = leftBase + left * zoom;
                    top = topBase + top * zoom;
                    _oldBR.push({ x: left, y: top, w: width, h: height });
                }
                setBarcodeRects(_oldBR)
            }
        }
    }
    const handleOutPutMessage = (message, type, bReset, bNoScroll) => {
        let _noScroll = false, _type = "info";
        if (type)
            _type = type;
        if (_type === "httpResponse") {
            let msgWindow = window.open("", "Response from server", "height=500,width=750,top=0,left=0,toolbar=no,menubar=no,scrollbars=no, resizable=no,location=no, status=no");
            msgWindow.document.writeln(message);
        } else {
            if (bNoScroll)
                _noScroll = true;
            if (bReset){
                setMessages([{
                    time: (new Date()).getTime(),
                    text: statusChangeText(props.status),
                    type: "info"
                }]);
                setBNoScroll(false);
            }else{
                setMessages( messages =>{
                    let newMessages = [...messages];
                    newMessages.push({ time: (new Date()).getTime(), text: message, type: _type });
                    return newMessages;
                });
                setBNoScroll(_noScroll);
            }
        }
    }
    const handleException = (ex) => {
        handleOutPutMessage(ex.message, "error");
    }
    const handleNavigating = (bAllow) => {
        setBNoNavigating(!bAllow)
    }
    const handleEvent = (evt) => {
        switch (evt) {
            default: break;
            case "doubleClick": handleOutPutMessage("", "", true); break;
            case "delete": handleOutPutMessage("", "", true); break;
        }
    }
    return(
        <div id="DWTcontainer" className="container">
                <div style={{ textAlign: "left", position: "relative", float: "left", width: "980px" }} className="fullWidth clearfix">
                    <DWTView
                        blocks={0b11} /** 1: navigate 2: quick edit */
                        dwt={props.dwt}
                        buffer={props.buffer}
                        zones={props.zones}
                        containerId={props.containerId}
                        runtimeInfo={props.runtimeInfo}
                        bNoNavigating={bNoNavigating}
                        barcodeRects={barcodeRects}
                        handleViewerSizeChange={(viewSize) => props.handleViewerSizeChange(viewSize)}
                        handleBufferChange={() => props.handleBufferChange()}
                        handleOutPutMessage={(message, type, bReset, bNoScroll) => handleOutPutMessage(message, type, bReset, bNoScroll)}
                    />
                    <Suspense>
                        <DWTController
                            Dynamsoft={props.Dynamsoft}
                            startTime={props.startTime}
                            features={props.features}
                            dwt={props.dwt}
                            buffer={props.buffer}
                            selected={props.selected}
                            zones={props.zones}
                            runtimeInfo={props.runtimeInfo}
                            barcodeRects={barcodeRects}
                            handleStatusChange={(value) => props.handleStatusChange(value)}
                            handleBarcodeResults={(results) => handleBarcodeResults(results)}
                            handleNavigating={(bAllow) => handleNavigating(bAllow)}
                            handleException={(ex) => handleException(ex)}
                            handleOutPutMessage={(message, type, bReset, bNoScroll) => handleOutPutMessage(message, type, bReset, bNoScroll)}
                        />
                    </Suspense>
                </div>
                <div style={{ textAlign: "left", position: "relative", float: "left", width: "980px" }} className="fullWidth clearfix">
                    <DWTOutPut
                        note={"(Double click or hit 'delete' to clear!)"}
                        handleEvent={(evt) => handleEvent(evt)}
                        messages={messages}
                        bNoScroll={bNoScroll}
                    />
                    <div className="DWT_Notice">
                        <p><strong>Platform &amp;Browser Support:</strong></p>Chrome|Firefox|Edge on Windows
                            <p><strong>OCR:</strong> </p> Only English with OCR Basic is demonstrated.<br />
                            Click &nbsp;
                            <u><a href='https://www.dynamsoft.com/Products/ocr-basic-languages.aspx'>here</a></u>
                            &nbsp;for other supported languages and&nbsp;
                            <u><a href='https://www.dynamsoft.com/Products/cpp-ocr-library.aspx'>here</a></u> for the differences betwen two available OCR engines.
                    </div>
                </div>
            </div >
    )
}

function usePrevious(value){
    const ref = useRef();

    useEffect(() => {
        ref.current = value;
    },[value]);
    
    return ref.current;
}