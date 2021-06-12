import {Duration} from 'argo-ui';
// import {DataLoader, Duration} from 'argo-ui';
import * as moment from 'moment';
import * as React from 'react';
import {Revision, Timestamp} from '../../../shared/components';
import * as models from '../../../shared/models';
// import {services} from '../../../shared/services';
// import {ApplicationParameters} from '../application-parameters/application-parameters';
import {RevisionMetadataRows} from './revision-metadata-rows';

require('./application-deployment-history.scss');

export const ApplicationDeploymentHistory = ({
    app,
    rollbackApp,
    selectedRollbackDeploymentIndex,
    selectDeployment
}: {
    app: models.Application;
    selectedRollbackDeploymentIndex: number;
    rollbackApp: (info: models.RevisionHistory) => any;
    selectDeployment: (index: number) => any;
}) => {
    const deployments = (app.status.history || []).slice().reverse();
    const recentDeployments = deployments.map((info, i) => {
        const nextDeployedAt = i === 0 ? null : deployments[i - 1].deployedAt;
        const runEnd = nextDeployedAt ? moment(nextDeployedAt) : moment();
        return {...info, nextDeployedAt, durationMs: runEnd.diff(moment(info.deployedAt)) / 1000};
    });

    return (
        <div className='application-deployment-history'>
            {recentDeployments.map((info, index) => (
                <div className='row application-deployment-history__item' key={info.deployedAt} onClick={() => selectDeployment(index)}>
                    <div className='columns small-3'>
                        <div>
                            <i className='fa fa-clock' /> 部署时间:
                            <br />
                            <Timestamp date={info.deployedAt} />
                        </div>
                        <div>
                            <br />
                            <i className='fa fa-hourglass-half' /> 耗时:
                            <br />
                            {(info.deployStartedAt && <Duration durationMs={moment(info.deployedAt).diff(moment(info.deployStartedAt)) / 1000} />) || 'Unknown'}
                        </div>
                        <div>
                            <br />
                            存活时间:
                            <br />
                            <Duration durationMs={info.durationMs} />
                        </div>
                    </div>
                    <div className='columns small-9'>
                        <div className='row'>
                            <div className='columns small-3'>版本:</div>
                            <div className='columns small-9'>
                                <Revision repoUrl={info.source.repoURL} revision={info.revision} />
                            </div>
                        </div>
                        {selectedRollbackDeploymentIndex === index ? (
                            <React.Fragment>
                                <RevisionMetadataRows
                                    applicationName={app.metadata.name}
                                    source={{...recentDeployments[index].source, targetRevision: recentDeployments[index].revision}}
                                />
                                {/*<DataLoader*/}
                                {/*    input={{...recentDeployments[index].source, targetRevision: recentDeployments[index].revision, appName: app.metadata.name}}*/}
                                {/*    load={src => services.repos.appDetails(src, src.appName)}>*/}
                                {/*    {(details: models.RepoAppDetails) => (*/}
                                {/*        <div>*/}
                                {/*            <ApplicationParameters*/}
                                {/*                application={{*/}
                                {/*                    ...app,*/}
                                {/*                    spec: {...app.spec, source: recentDeployments[index].source}*/}
                                {/*                }}*/}
                                {/*                details={details}*/}
                                {/*            />*/}
                                {/*        </div>*/}
                                {/*    )}*/}
                                {/*</DataLoader>*/}
                            </React.Fragment>
                        ) : null}
                    </div>
                </div>
            ))}
        </div>
    );
};
