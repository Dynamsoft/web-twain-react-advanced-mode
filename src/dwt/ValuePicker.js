import React, {useRef , useState , useEffect, useCallback} from 'react';
import './ValuePicker.css';

/**
 * @props
 * @prop {object} Dynamsoft a namespace
 * @prop {object[]} valuePacks the value packs to display
 */
export default function ValuePicker(props) {
    const valuesList = useRef();
    const [current, setCurrent] = useState(props.current)
    const [currentValues, setCurrentValues] = useState([])
    const prevTargetObject = usePrevious(props.targetObject)

    const changeScrollTop = useCallback(() => {
        let _valueLIs = valuesList.current.children, _scrollTop = 0, _height = 0;
        if (_valueLIs && _valueLIs.length > 0) {
            for (let i = 0; i < currentValues.length; i++) {
                if (currentValues[i].checked) {
                    _scrollTop = _valueLIs[i].offsetTop;
                    _height = _valueLIs[i].offsetHeight;
                }
            }
        }
        if (valuesList.current.scrollTop - _scrollTop > 0)
            valuesList.current.scrollTop = _scrollTop;
        else if (valuesList.current.scrollTop + valuesList.current.offsetHeight < _scrollTop + _height) {
            valuesList.current.scrollTop = _scrollTop + _height - valuesList.current.offsetHeight;
        }
    },[currentValues])

    useEffect(() => {
        let _valuePacks = props.valuePacks;
        if(currentValues.length === 0 || props.targetObject !== prevTargetObject){
            for(let i = 0; i < _valuePacks.length; i++) {
                if (_valuePacks[i].name === props.current) {
                    setCurrentValues(_valuePacks[i].items)
                    return;
                }
            }
        }
        changeScrollTop()
    },[props, currentValues.length, prevTargetObject,changeScrollTop])

    useEffect(() => {
        changeScrollTop()
    },[currentValues,changeScrollTop])

    const handlePackChange = (event) => {
        if (event.keyCode && event.keyCode !== 32) return;
        if (event.keyCode && event.keyCode === 32) event.preventDefault();
        let packName = event.target.getAttribute("value");
        for (let i = 0; i < props.valuePacks.length; i++) {
            if (props.valuePacks[i].name === packName) {
                setCurrentValues(props.valuePacks[i].items);
                setCurrent(packName)
                break;
            }
        }
    }
    const handleValuePicked = (event) => {
        if (event.keyCode && event.keyCode !== 32) return;
        if (event.keyCode && event.keyCode === 32) event.preventDefault();
        let value = event.target.getAttribute("value");
        let old_Values = [...currentValues];
        for (let i = 0; i < old_Values.length; i++) {
            if (old_Values[i].value === value)
                old_Values[i].checked = true;
            else
                old_Values[i].checked = false;
            setCurrentValues(old_Values);
            props.handleValuePicking({prop: current, value: value});
        }
    }

    return (
        <div className="valuePicker">
            <ul>
                {
                    props.valuePacks.map((topItem, _key) =>
                        <li tabIndex={props.tabIndex}
                            className={(topItem.name === current) ? "current" : ""}
                            value={topItem.name}
                            key={Math.floor(Math.random() * 10000000)}
                            onClick={(event) => handlePackChange(event)}
                            onKeyUp={(event) => handlePackChange(event)}
                        >{topItem.name}</li>
                    )
                }
            </ul>
            <ul ref={valuesList}>
                {
                    currentValues.map((values, __key) => (
                        <li tabIndex={props.tabIndex}
                            className={values.checked ? "current" : ""}
                            value={values.value}
                            key={Math.floor(Math.random() * 10000000)}
                            onClick={(event) => handleValuePicked(event)}
                            onKeyUp={(event) => handleValuePicked(event)}
                        >{values.value}</li>
                    ))
                }
            </ul>
        </div>
    );
}

function usePrevious(value){
    const ref = useRef();

    useEffect(() => {
        ref.current = value;
    },[value]);
    
    return ref.current;
}