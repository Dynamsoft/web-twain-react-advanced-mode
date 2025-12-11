import React, { useRef } from 'react';
import './RangePicker.css';

/**
 * @props
 * @prop {object} Dynamsoft a namespace
 * @prop {object} rangePicker info about the range 
 */
 let offsetX , offsetY , oldX , oldY;
export default function RangePicker(props) {
    const rangePicker = useRef();
    const overlayDIV = useRef();
    const move = (e) => {
        const parent = rangePicker.current;
        parent.style.left = `${oldX + (e.clientX - offsetX)}px`;
        parent.style.top = `${oldY + (e.clientY - offsetY)}px`;
        oldX = parent.offsetLeft;
        offsetX = e.clientX;
        oldY = parent.offsetTop;
        offsetY = e.clientY;
    }
    const add = (e) => {
        const parent = rangePicker.current;
        oldX = parent.offsetLeft;
        oldY = parent.offsetTop;
        offsetX = e.clientX;
        offsetY = e.clientY;
        parent.addEventListener('mousemove', move);
        overlayDIV.current.addEventListener('mousemove', move);
    }
    const remove = (e) => {
        rangePicker.current.removeEventListener('mousemove', move);
        overlayDIV.current.removeEventListener('mousemove', move);
    }

    return (
    <><div ref={overlayDIV} className="overlay" onMouseUp={remove}></div>
    <div ref={rangePicker} className="range-Picker" onMouseUp={remove}>
        <div className="range-title" onMouseDown={add}>
            <span className="range-title" >{props.rangePicker.title}</span>
        </div>
        <div className="range-content">
            {props.rangePicker.bMutable
                ? (<>
                    <span className="range-current" >{props.rangePicker.value} (Default: {props.rangePicker.defaultvalue})</span>
                    <span>{props.rangePicker.min}</span>
                    <input type="range"
                        prop={props.rangePicker.title} _type={props.rangePicker.bCamera ? "camera" : "video"}
                        min={props.rangePicker.min} max={props.rangePicker.max}
                        step={props.rangePicker.step} value={props.rangePicker.value}
                        onChange={(event) => props.handleRangeChange(event)} />
                    <span>{props.rangePicker.max}</span>
                </>)
                : (<span className="range-current" >Default and only value (immutable): {props.rangePicker.value}</span>)}
        </div>
        <div className="range-buttons">
            {props.rangePicker.bMutable ? <button prop={props.rangePicker.title}
                _type={props.rangePicker.bCamera ? "camera" : "video"}
                _default={props.rangePicker.defaultvalue}
                value="reset-range" onClick={(event) => props.handleRangeChange(event)}>Reset &amp; Close</button> : ""}
            < button value="close-picker" onClick={(event) => props.handleRangeChange(event)}>Close Window</button>
        </div>
    </div>
</>
);
}