import {DataLoader, Tab, Tabs} from 'argo-ui';
import * as moment from 'moment';
import * as React from 'react';

import {YamlEditor} from '../../../shared/components';
import * as models from '../../../shared/models';
import {services} from '../../../shared/services';
import {ApplicationResourcesDiff} from '../application-resources-diff/application-resources-diff';
import {ComparisonStatusIcon, getPodStateReason, HealthStatusIcon} from '../utils';

require('./application-node-info.scss');

export const ApplicationNodeInfo = (props: {
    application: models.Application;
    node: models.ResourceNode;
    live: models.State;
    controlled: {summary: models.ResourceStatus; state: models.ResourceDiff};
}) => {
    const attributes: {title: string; value: any}[] = [
        {title: 'KIND', value: props.node.kind},
        {title: '名称', value: props.node.name},
        {title: '命名空间NS', value: props.node.namespace}
    ];
    if (props.node.createdAt) {
        attributes.push({
            title: '创建时间',
            value: moment
                .utc(props.node.createdAt)
                .local()
                .format('MM/DD/YYYY HH:mm:ss')
        });
    }
    if ((props.node.images || []).length) {
        attributes.push({
            title: '镜像',
            value: (
                <div className='application-node-info__labels'>
                    {(props.node.images || []).sort().map(image => (
                        <span className='application-node-info__label' key={image}>
                            {image}
                        </span>
                    ))}
                </div>
            )
        });
    }
    if (props.live) {
        if (props.node.kind === 'Pod') {
            const {reason, message} = getPodStateReason(props.live);
            attributes.push({title: '状态', value: reason});
            if (message) {
                attributes.push({title: '状态 明细', value: message});
            }
        } else if (props.node.kind === 'Service') {
            attributes.push({title: '类型', value: props.live.spec.type});
            let hostNames = '';
            const status = props.live.status;
            if (status && status.loadBalancer && status.loadBalancer.ingress) {
                hostNames = (status.loadBalancer.ingress || []).map((item: any) => item.hostname || item.ip).join(', ');
            }
            attributes.push({title: '主机名称', value: hostNames});
        }
    }

    if (props.controlled) {
        if (!props.controlled.summary.hook) {
            attributes.push({
                title: '状态',
                value: (
                    <span>
                        <ComparisonStatusIcon status={props.controlled.summary.status} resource={props.controlled.summary} label={true} />
                    </span>
                )
            } as any);
        }
        if (props.controlled.summary.health !== undefined) {
            attributes.push({
                title: '健康状态',
                value: (
                    <span>
                        <HealthStatusIcon state={props.controlled.summary.health} /> {props.controlled.summary.health.status}
                    </span>
                )
            } as any);
            if (props.controlled.summary.health.message) {
                attributes.push({title: 'HEALTH DETAILS', value: props.controlled.summary.health.message});
            }
        }
    }

    const tabs: Tab[] = [
        {
            key: 'manifest',
            title: '实时资源描述',
            content: (
                <YamlEditor
                    input={props.live}
                    hideModeButtons={false}
                    initialEditMode={false}
                    onSave={(patch, patchType) => services.applications.patchResource(props.application.metadata.name, props.node, patch, patchType)}
                />
            )
        }
    ];
    if (props.controlled && !props.controlled.summary.hook) {
        tabs.push({
            key: 'diff',
            icon: 'fa fa-file-medical',
            title: '差异对比',
            content: <ApplicationResourcesDiff states={[props.controlled.state]} />
        });
        tabs.push({
            key: 'desiredManifest',
            title: '声明定义',
            content: <YamlEditor input={props.controlled.state.targetState} hideModeButtons={true} />
        });
    }

    return (
        <div>
            <div className='white-box'>
                <div className='white-box__details'>
                    {attributes.map(attr => (
                        <div className='row white-box__details-row' key={attr.title}>
                            <div className='columns small-3'>{attr.title}</div>
                            <div className='columns small-9'>{attr.value}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className='application-node-info__manifest'>
                <DataLoader load={() => services.viewPreferences.getPreferences()}>
                    {pref => (
                        <Tabs
                            selectedTabKey={(tabs.length > 1 && pref.appDetails.resourceView) || 'manifest'}
                            tabs={tabs}
                            onTabSelected={selected => {
                                services.viewPreferences.updatePreferences({appDetails: {...pref.appDetails, resourceView: selected as any}});
                            }}
                        />
                    )}
                </DataLoader>
            </div>
        </div>
    );
};
