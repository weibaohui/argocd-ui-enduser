import {DataLoader, Tooltip} from 'argo-ui';
import * as React from 'react';
import {Timestamp} from '../../../shared/components/timestamp';
import {services} from '../../../shared/services';

export const RevisionMetadataPanel = (props: {appName: string; type: string; revision: string}) => {
    if (props.type === 'helm') {
        return <React.Fragment />;
    }
    return (
        <DataLoader load={() => services.applications.revisionMetadata(props.appName, props.revision)} errorRenderer={() => <div />}>
            {m => (
                <Tooltip
                    popperOptions={{
                        modifiers: {
                            preventOverflow: {
                                enabled: false
                            },
                            flip: {
                                enabled: false
                            }
                        }
                    }}
                    content={
                        <span>
                            {m.author && <React.Fragment> {m.author}</React.Fragment>}
                            {m.date && <Timestamp date={m.date} />}
                            {m.tags && <span>Tags: {m.tags}</span>}
                            {m.signatureInfo}
                            {m.message}
                        </span>
                    }
                    placement='bottom'
                    allowHTML={true}>
                    <div className='application-status-panel__item-name'>
                        {m.author && (
                            <div className='application-status-panel__item__row'>
                                <div>作者:</div>
                                <div>
                                    {m.author} - {m.signatureInfo}
                                </div>
                            </div>
                        )}
                        <div className='application-status-panel__item__row'>
                            <div>说明:</div>
                            <div>{m.message.split('\n')[0].slice(0, 64)}</div>
                        </div>
                    </div>
                </Tooltip>
            )}
        </DataLoader>
    );
};
