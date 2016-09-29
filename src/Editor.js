import React from 'react';
import cx from 'classnames';
import update from 'react-addons-update';

import { PropTypes } from './constants';

import Scrim from './Scrim';

import * as Schema from './Schema';

import _ from 'lodash';

const empty = () => null;

// Returns true if `schemaType` is one of the array types -- "array", or "arrayOf".
const isArraySchemaType = schemaType => {
    return schemaType._type && schemaType._type.match(/array/) !== null;
};

// Base propTypes for all editor variants
const BASE_EDITOR_PROPTYPES = {
    // Schema for the elements in the array
    // TODO: add "render" functions to type somehow, so that an element can provide a custom
    // TODO: render function for any of its cells
    // TODO: pass validation functions through schema
    type: PropTypes.Schema.isRequired,

    // Optional: classes to apply to the editor wrapper
    className: React.PropTypes.string,

    // Optional.
    // A function that returns a react node to use for the icon
    icon: React.PropTypes.func,
};

// Returns the column title for the SchemaType `schemaType`.
function columnTitle (schemaType) {
    // Complex object schema
    if (typeof schemaType === 'object') {
        return 'Object';
    }

    // If it's an array type, use the elementType property.
    if (isArraySchemaType(schemaType)) {
        return 'Array of ' + columnTitle(schemaType._elementType || Schema.SchemaTypes.any);
    }

    // Otherwise, just use the _type field.
    return _.capitalize(schemaType._type);
}

// A <th /> Element with a the class ".editor__column-title"
const ColumnTitle = props => {
    const classes = cx(
        'column-title',
        props.className
    );

    return (
        <th className={classes}>
            { props.children }
        </th>
    );
};
ColumnTitle.displayName = 'ColumnTitle';
ColumnTitle.propTypes = {
    // Optional extra classes for the <th />
    className: React.PropTypes.string,

    // Children of the <th />
    children: React.PropTypes.node,
};

class BaseTable extends React.Component {
    static displayName = 'BaseTable';

    static propTypes = {
        ...BASE_EDITOR_PROPTYPES,

        // The thing to edit
        // Can be anything for a base editor (which doesn't actually render an editor)
        object: React.PropTypes.any,
    };

    // Render the column titles based on a primitive schema type.
    renderPrimitiveColumns = () => {
        return <ColumnTitle>{ columnTitle(this.props.type) }</ColumnTitle>;
    };

    // Render column titles based on a complex object-schema
    renderObjectColumns = () => {
        // A column for each element key
        return Object.keys(this.props.type).map(
            field => (
                <ColumnTitle>{ field }</ColumnTitle>
            )
        );
    };

    render () {
        const isPrimitiveSchema = !!this.props.type._isSchemaType;

        return (
            <table className={cx('editor', this.props.className)}>
                <thead>
                <tr className="editor__column-titles">
                    <th>
                        {/* Blank -- just for spacing */}
                        {/* This is the icon column */}
                    </th>

                    {
                        isPrimitiveSchema
                            ? this.renderPrimitiveColumns()
                            : this.renderObjectColumns()
                    }

                    <th>
                        {/* Blank -- just for spacing */}
                        {/* This is the delete object column */}
                    </th>
                </tr>
                </thead>

                <tbody>

                {/* Render children in tbody */}
                { this.props.children }

                </tbody>
            </table>
        );
    }
}

// A tabular editor for editing a single JSON object
class ObjectEditor extends React.Component {
    static displayName = 'ObjectEditor';

    static propTypes = {
        ...BASE_EDITOR_PROPTYPES,

        // The thing to edit. Can be either
        // * an object with shape specified in type
        // * undefined
        object: React.PropTypes.object,

        // Handler called when the object is updated
        // function onUpdateElement (updatedObject) -> void
        // updatedObject is the current object with updates applied
        onUpdateElement: React.PropTypes.func.isRequired,
    };

    static defaultProps = {
        className: '',
    };

    render () {
        return (
            <BaseTable type={this.props.type} className={cx('editor--object', this.props.className)}>
                { /* Object is just an individual object, so there's only one row */ }
                <ElementRow
                    className="editor__row--object"
                    icon={this.props.icon || undefined}
                    trash={empty /* no trash button for single objects */}
                    type={this.props.type}
                    object={this.props.object}
                    onChange={this.props.onUpdateElement}
                    onRemove={empty /* Can't remove a single object */} />
            </BaseTable>
        );
    }
};

const ScrimObjectEditor = Scrim(ObjectEditor);

// A tabular editor for editing an array of JSON objects in real time
class ArrayEditor extends React.Component {
    static displayName = 'Editor';

    static propTypes = {
        ...BASE_EDITOR_PROPTYPES,

        // The thing to edit. Must be either
        // * an array of the objects with shape specified in type
        // * undefined
        object: React.PropTypes.array,

        // Handler called when one of the elements in object is modified
        //
        // function onUpdateElement (updatedElement: Object, index: Number) -> void
        // where updatedElement is the element that has been updated, and
        // index is the index of updatedElement in the the object prop
        onUpdateElement: React.PropTypes.func.isRequired,

        // Handler called when one of the elements is removed
        //
        // function onUpdateElement (removedElement: Object, index: Number) -> void
        // where removedElement is the element that has been removed, and
        // index is the index of removedElement in the the object prop
        onRemoveElement: React.PropTypes.func.isRequired,

        // Handler called when a new element is added
        // function onAddElement (newElement: Object) -> void
        // where newElement is the element to add
        onAddElement: React.PropTypes.func.isRequired,
    };

    static defaultProps = {
        className: '',
    };

    render () {
        return (
            <BaseTable type={this.props.type} className={cx('editor--array', this.props.className)}>

                {
                    _.map(
                        this.props.object,
                        (el, idx) => <ElementRow
                            className="editor__row--array"
                            icon={this.props.icon || undefined}
                            type={this.props.type}
                            object={el}
                            onChange={updated => this.props.onUpdateElement(updated, idx)}
                            onRemove={() => this.props.onRemoveElement(el, idx)}/>
                    )
                }

                <AddObjectRow
                    type={this.props.type}
                    onAddElement={this.props.onAddElement}/>
            </BaseTable>
        );
    }
};

// A table row for adding a new element to an array
// TODO: error handling, validation
// TODO: support empty values for certain types
class AddObjectRow extends React.Component {
    static displayName = 'AddObjectRow';

    static propTypes = {
        // The schema to to use for creating new element
        type: PropTypes.Schema.isRequired,

        // Handler called when a new element is added
        // If this function returns anything truthy, the object row is cleared (so a new object can be added).
        // If this function returns anything falsey, the object row will not be cleared.
        //
        // function onAddElement (newElement: Object) -> boolean
        onAddElement: React.PropTypes.func.isRequired,
    };

    constructor (props) {
        super(props);

        this.state = {
            // Initialize with empty object
            object: null,
        };
    }

    // Handler called when the "add" button is clicked
    // Only pass to consumer if state is non-null -- user needs to enter something
    // before they can add additional elements.
    add = () => {
        // Nothing entered in fields yet
        if (this.state.object === null) {
            return;
        }

        const result = this.props.onAddElement(this.state.object);

        // If consumer returned true, reset fields.
        if (result) {
            return this.setState({
                object: null,
            });
        }
    };

    // Renders the "add element" button
    addButton = () => {
        return <button onClick={this.add}>Add</button>;
    };

    // Handler for updates to the object in state.
    // Simply sets object equal to the update.
    updateObject = updated => {
        this.setState({
            object: updated
        });
    };

    render () {
        const rowClasses = cx('editor__add-object');
        return (
            <ElementRow
                className={rowClasses}
                type={this.props.type}
                icon={empty /* no icon for the add object row */}
                trash={this.addButton}
                object={this.state.object}
                onChange={this.updateObject}
                onRemove={empty /* unused by this component */} />
        );
    }
}

// Scrim version of the array editor.
const ScrimArrayEditor = Scrim(ArrayEditor);

// The primitive types that we'll use <input /> elements for.
// Other types will get nested object editors.
const STRING_INPUT_TYPES = [
    'string', 'boolean', 'number', 'date'
];

// A td cell for editing a property whose type is anything but 'object'
class StringCell extends React.Component {
    static displayName = 'StringCell';

    static propTypes = {
        // The type of this cell
        type: PropTypes.Schema.isRequired,

        // Current value of this cell
        value: React.PropTypes.any,

        // Handler called when the value is modified
        onChange: React.PropTypes.func.isRequired,
    };

    render () {
        return (
            <td className="cell--value">
                <input
                    className='form-control input--value'
                    type='text'
                    value={this.props.value || ''}
                    required={this.props.type.required}
                    onChange={evt => this.props.onChange(evt.target.value)}/>
            </td>
        );
    }
}

// A td cell for editing a property of type `object`
// This cell will spawn nested editors using the scrimmed Editors
class ObjectCell extends React.Component {
    static displayName = 'ObjectCell';

    static propTypes = {
        // The type of this cell
        type: PropTypes.Schema.isRequired,

        // Current value of this cell
        value: React.PropTypes.any,

        // Handler called when the value is modified
        onChange: React.PropTypes.func.isRequired,
    };

    state = {
        open: false
    };

    // Toggle open the editor when the edit button is clicked.
    clickEdit = evt => {
        this.setState({
            open: !this.state.open
        });
    };

    // Close the editor
    close = evt => {
        this.setState({
            open: false,
        });
    };

    // Conditionally renders the value editor (depending on whether
    // the cell is toggled open)
    // TODO: too many conditionals here -- separate into different Cell classes
    renderEditor = () => {
        // Cell is closed -- render nothing
        if (!this.state.open) {
            return <div></div>
        }

        // Whether or not to use an Array editor
        const useArrayEditor = (
            // Use an array editor if the SchemaType is one of the array variants (array or arrayOf)
            (this.props.type._type && this.props.type._type.match(/array/) !== null) ||

            // Also use one if the value is an array
            Array.isArray(this.props.value)
        );

        // The Editor component to use
        const Editor = useArrayEditor
            ? ScrimArrayEditor
            : ScrimObjectEditor;

        // The type to pass to the editor -- if it's an object editor, that's just the current type.
        // If it's an array editor, we need to use the array's type.
        const editorType = useArrayEditor
            // If we're using an array editor, use the types's own _elementType or allow any
            ? this.props.type._elementType || Schema.SchemaTypes.any

            // Otherwise use the existing type
            : this.props.type;


        // The value to use for array operations -- allows us to have an empty value.
        const arrayValue = this.props.value || [];

        // Cell is open -- render the value editor

        // TODO: pull these update/add/remove handlers out of the render func
        // TODO: separate Cells for arrays, since the onUpdateElement function sig is different
        return (
            <Editor
                onClickScrim={this.close}

                className='editor--inside'
                type={editorType}
                object={this.props.value}
                onUpdateElement={
                    /* This function needs to handle array and object property updates */
                    (el, updatedIndex) => {
                        // Array update
                        if (typeof updatedIndex !== 'undefined') {
                            return this.props.onChange(
                                update(
                                    arrayValue,
                                    {
                                        [updatedIndex]: {
                                            $set: el,
                                        }
                                    }
                                )
                            );
                        }

                        // "set" object property update
                        return this.props.onChange(el);
                    }
                }
                onRemoveElement={
                    // Tell the consumer an element was removed
                    (el, droppedIndex) => this.props.onChange(
                        // Without mutating the array, reject the dropped index
                        _.reject(
                            arrayValue,
                            (__, idx) => idx === droppedIndex
                        )
                    )
                }
                onAddElement={
                    (el) => {
                        // Pass element to consumer
                        this.props.onChange(
                            [ ...arrayValue, el ]
                        );

                        // Clear the nested add row
                        return true;
                    }
                } />
        );
    };

    render () {
        return (
            <td className='cell--object'>
                <button onClick={this.clickEdit}>Edit</button>

                { this.renderEditor() }
            </td>
        );
    }
}

// Render an object as a row in a table.
// The "icon" prop gets render as the furthest-left td, and the
// "trash" prop gets render as the furthest-right td.
const ElementRow = props => {
    // For some key, returns a handler that calls props.onChange with the
    // value of props.object[key].
    // Support null/undefined objects.
    const getChangeHandler = key => newValue => {
        // Element doesn't have a value at this key yet
        // So create an object with this key
        if (!props.object) {
            return props.onChange({
                [key]: newValue
            });
        }

        // Set key = newValue and pass to consumer
        return props.onChange(update(
            props.object,
            {
                [key]: {
                    $set: newValue
                }
            }
        ));
    };

    // The trash button (if the consumer didn't specify one)
    const trashButton = (
        <button onClick={props.onRemove}>Trash</button>
    );

    // Render a cell based on a primitive SchemaType, a value, and a handler
    const renderCell = (primitiveType, value, handler) => {
        const isStringType = _.includes(STRING_INPUT_TYPES, primitiveType._type)

        const CellType = isStringType
            ? StringCell
            : ObjectCell;

        return <CellType
            type={primitiveType}
            value={value}
            onChange={handler} />
    };

    // If props.type is a primitive (i.e. type._isSchemaType is true), we just render a single td
    // based on props.type.
    // If props.type is an object, we render td:s for each key in the object.
    const renderElementBody = () => {
        // Primitive case
        if (props.type._isSchemaType) {
            return renderCell(
                // Just use the type directly
                props.type,

                // Use the object directly
                props.object || null,

                // The change handler just returns the new value directly
                props.onChange
            );
        }

        // Object case
        return _.map(
            Object.keys(props.type),
            key => {
                const value = props.object
                    ? props.object[key]
                    : null;

                return renderCell(
                    props.type[key],
                    value,
                    getChangeHandler(key)
                );
            }
        );
    };

    const rowClasses = cx(
        'editor__row',
        props.className || ''
    );

    return (
        <tr className={rowClasses}>
            <td>
                {
                    // Icon for the element
                    props.icon
                        ? props.icon()
                        : <i>C</i>
                }
            </td>

            {/*
              * Render the "body" of the element -- for an object, cells for each key.
              * For a primitive, a single cell.
              */}
            { renderElementBody() }

            <td>
                {
                    props.trash
                        ? props.trash()
                        : trashButton
                }
            </td>
        </tr>
    );
};
ElementRow.displayName = 'ElementRow';
ElementRow.propTypes = {
    // The type of this field -- a SchemaType
    // type: PropTypes.SchemaType.isRequired,
    type: PropTypes.Schema.isRequired,

    // Icon to use for the field
    icon: React.PropTypes.func,

    // Content for the trash button cell
    trash: React.PropTypes.func,

    // The element itself (should have the type `type`)
    object: React.PropTypes.any,

    // Handler called when the element is updated
    //
    // function onChange (updatedElement: Object) -> void
    onChange: React.PropTypes.func.isRequired,

    // Handler called when the user clicks the remove button
    // Called with no arguments
    //
    // function onRemove () -> void
    onRemove: React.PropTypes.func.isRequired,

    // Optional extra classes to add to the <tr />
    className: React.PropTypes.string,
};

export { ObjectEditor, ArrayEditor };
