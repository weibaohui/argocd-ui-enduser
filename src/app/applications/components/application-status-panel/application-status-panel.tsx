import {HelpIcon} from 'argo-ui';
import * as React from 'react';
import {DataLoader} from '../../../shared/components';
import {Revision} from '../../../shared/components/revision';
import {Timestamp} from '../../../shared/components/timestamp';
import * as models from '../../../shared/models';
import {services} from '../../../shared/services';
import {ApplicationSyncWindowStatusIcon, ComparisonStatusIcon, getAppOperationState, getConditionCategory, HealthStatusIcon, OperationState, syncStatusMessage} from '../utils';
import {RevisionMetadataPanel} from './revision-metadata-panel';

require('./application-status-panel.scss');

interface Props {
    application: models.Application;
    showOperation?: () => any;
    showConditions?: () => any;
    showMetadataInfo?: (revision: string) => any;
}

interface SectionInfo {
    title: string;
    helpContent?: string;
}

const sectionLabel = (info: SectionInfo) => (
    <label>
        {info.title}
        {info.helpContent && <HelpIcon title={info.helpContent} />}
    </label>
);

const sectionHeader = (info: SectionInfo, onClick?: () => any) => {
    return (
        <div style={{display: 'flex', alignItems: 'center'}}>
            {sectionLabel(info)}
            {onClick && (
                <button className='argo-button argo-button--base-o argo-button--sm application-status-panel__more-button' onClick={onClick}>
                    更多
                </button>
            )}
        </div>
    );
};

export const ApplicationStatusPanel = ({application, showOperation, showConditions, showMetadataInfo}: Props) => {
    const today = new Date();

    let daysSinceLastSynchronized = 0;
    const history = application.status.history || [];
    if (history.length > 0) {
        const deployDate = new Date(history[history.length - 1].deployedAt);
        daysSinceLastSynchronized = Math.round(Math.abs((today.getTime() - deployDate.getTime()) / (24 * 60 * 60 * 1000)));
    }
    const cntByCategory = (application.status.conditions || []).reduce(
        (map, next) => map.set(getConditionCategory(next), (map.get(getConditionCategory(next)) || 0) + 1),
        new Map<string, number>()
    );
    const appOperationState = getAppOperationState(application);
    if (application.metadata.deletionTimestamp && !appOperationState) {
        showOperation = null;
    }

    const infos = cntByCategory.get('info');
    const warnings = cntByCategory.get('warning');
    const errors = cntByCategory.get('error');

    return (
        <div className='application-status-panel row'>
            <div className='application-status-panel__item'>
                {sectionLabel({title: '体检', helpContent: '应用健康状态'})}
                <div className='application-status-panel__item-value'>
                    <HealthStatusIcon state={application.status.health} />
                    &nbsp;
                    {application.status.health.status}
                </div>
                {application.status.health.message && <div className='application-status-panel__item-name'>{application.status.health.message}</div>}
            </div>
            <div className='application-status-panel__item'>
                <React.Fragment>
                    {sectionHeader(
                        {
                            title: '当前同步状态',
                            helpContent: '您的应用程序版本是否与您的存储库保持同步。如果应用程序不同步，您可能希望同步它。'
                        },
                        application.spec.source.chart ? null : () => showMetadataInfo(application.status.sync ? application.status.sync.revision : '')
                    )}
                    <div className='application-status-panel__item-value'>
                        <div>
                            <ComparisonStatusIcon status={application.status.sync.status} label={true} />
                        </div>
                        <div className='application-status-panel__item-value__revision'>{syncStatusMessage(application)}</div>
                    </div>
                    <div className='application-status-panel__item-name'>
                        {application.status && application.status.sync && application.status.sync.revision && (
                            <RevisionMetadataPanel appName={application.metadata.name} type={application.spec.source.chart && 'helm'} revision={application.status.sync.revision} />
                        )}
                    </div>
                </React.Fragment>
            </div>
            {appOperationState && (
                <div className='application-status-panel__item'>
                    <React.Fragment>
                        {sectionHeader(
                            {
                                title: '终态',
                                helpContent: '应用上次同步是在' + daysSinceLastSynchronized + '天以前，单击查看最新状态.'
                            },
                            application.spec.source.chart ? null : () => showMetadataInfo(appOperationState.syncResult ? appOperationState.syncResult.revision : '')
                        )}
                        <div className={`application-status-panel__item-value application-status-panel__item-value--${appOperationState.phase}`}>
                            <a onClick={() => showOperation && showOperation()}>
                                <OperationState app={application} />{' '}
                            </a>
                            {appOperationState.syncResult && appOperationState.syncResult.revision && (
                                <div className='application-status-panel__item-value__revision'>
                                    To <Revision repoUrl={application.spec.source.repoURL} revision={appOperationState.syncResult.revision} />
                                </div>
                            )}
                        </div>

                        <div className='application-status-panel__item-name'>
                            {appOperationState.phase} <Timestamp date={appOperationState.finishedAt || appOperationState.startedAt} />
                        </div>
                        {(appOperationState.syncResult && appOperationState.syncResult.revision && (
                            <RevisionMetadataPanel
                                appName={application.metadata.name}
                                type={application.spec.source.chart && 'helm'}
                                revision={appOperationState.syncResult.revision}
                            />
                        )) || <div className='application-status-panel__item-name'>{appOperationState.message}</div>}
                    </React.Fragment>
                </div>
            )}
            {application.status.conditions && (
                <div className={`application-status-panel__item`}>
                    {sectionLabel({title: '应用自适应'})}
                    <div className='application-status-panel__item-value application-status-panel__conditions' onClick={() => showConditions && showConditions()}>
                        {infos && (
                            <a className='info'>
                                <i className='fa fa-info-circle' /> {infos} Info
                            </a>
                        )}
                        {warnings && (
                            <a className='warning'>
                                <i className='fa fa-exclamation-triangle' /> {warnings} Warning{warnings !== 1 && 's'}
                            </a>
                        )}
                        {errors && (
                            <a className='error'>
                                <i className='fa fa-exclamation-circle' /> {errors} Error{errors !== 1 && 's'}
                            </a>
                        )}
                    </div>
                </div>
            )}
            <DataLoader
                noLoaderOnInputChange={true}
                input={application.metadata.name}
                load={async name => {
                    return await services.applications.getApplicationSyncWindowState(name);
                }}>
                {(data: models.ApplicationSyncWindowState) => (
                    <React.Fragment>
                        {data.assignedWindows && (
                            <div className='application-status-panel__item' style={{position: 'relative'}}>
                                {sectionLabel({
                                    title: '同步指示',
                                    helpContent: '此应用程序的同步状态。 红色: 不允许同步. 黄色: 允许手动同步. 绿色: 允许所有同步'
                                })}
                                <div className='application-status-panel__item-value' style={{margin: 'auto 0'}}>
                                    <ApplicationSyncWindowStatusIcon project={application.spec.project} state={data} />
                                </div>
                            </div>
                        )}
                    </React.Fragment>
                )}
            </DataLoader>
        </div>
    );
};
