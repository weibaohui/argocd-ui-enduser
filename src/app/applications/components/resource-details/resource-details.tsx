import {DataLoader, Tab, Tabs} from 'argo-ui';
import * as React from 'react';
import {EventsList} from '../../../shared/components';
import {Context} from '../../../shared/context';
import {Application, ApplicationTree, Event, ResourceNode, State} from '../../../shared/models';
import {services} from '../../../shared/services';
import {NodeInfo, SelectNode} from '../application-details/application-details';
import {ApplicationNodeInfo} from '../application-node-info/application-node-info';
import {ResourceTreeNode} from '../application-resource-tree/application-resource-tree';
import {PodsLogsViewer} from '../pod-logs-viewer/pod-logs-viewer';
import {ResourceIcon} from '../resource-icon';
import {ResourceLabel} from '../resource-label';
import * as AppUtils from '../utils';
import './resource-details.scss';
interface ResourceDetailsProps {
    selectedNode: ResourceNode;
    updateApp: (app: Application) => Promise<any>;
    application: Application;
    isAppSelected: boolean;
    tree: ApplicationTree;
    tab?: string;
}

export const ResourceDetails = (props: ResourceDetailsProps) => {
    const {selectedNode, application, isAppSelected, tree} = {...props};
    const appContext = React.useContext(Context);
    const tab = new URLSearchParams(appContext.history.location.search).get('tab');
    const selectedNodeInfo = NodeInfo(new URLSearchParams(appContext.history.location.search).get('node'));
    const selectedNodeKey = selectedNodeInfo.key;

    const page = parseInt(new URLSearchParams(appContext.history.location.search).get('page'), 10) || 0;
    const untilTimes = (new URLSearchParams(appContext.history.location.search).get('untilTimes') || '').split(',') || [];

    const getResourceTabs = (node: ResourceNode, state: State, podState: State, events: Event[], tabs: Tab[]) => {
        if (!node || node === undefined) {
            return [];
        }
        if (state) {
            const numErrors = events.filter(event => event.type !== 'Normal').reduce((total, event) => total + event.count, 0);
            tabs.push({
                title: '??????',
                icon: 'fa fa-calendar-alt',
                badge: (numErrors > 0 && numErrors) || null,
                key: 'events',
                content: (
                    <div className='application-resource-events'>
                        <EventsList events={events} />
                    </div>
                )
            });
        }
        if (podState && podState.metadata && podState.spec) {
            const containerGroups = [
                {
                    offset: 0,
                    title: '??????',
                    containers: podState.spec.containers || []
                },
                {
                    offset: (podState.spec.containers || []).length,
                    title: '????????????',
                    containers: podState.spec.initContainers || []
                }
            ];
            tabs = tabs.concat([
                {
                    key: 'logs',
                    icon: 'fa fa-align-left',
                    title: '??????',
                    content: (
                        <div className='application-details__tab-content-full-height'>
                            <div className='row'>
                                <div className='columns small-3 medium-2'>
                                    {containerGroups.map(group => (
                                        <div key={group.title} style={{marginBottom: '1em'}}>
                                            {group.containers.length > 0 && <p>{group.title}</p>}
                                            {group.containers.map((container: any, i: number) => (
                                                <div
                                                    className='application-details__container'
                                                    key={container.name}
                                                    onClick={() => SelectNode(selectedNodeKey, group.offset + i, 'logs', appContext)}>
                                                    {group.offset + i === selectedNodeInfo.container && <i className='fa fa-angle-right' />}
                                                    <span title={container.name}>{container.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                                <div className='columns small-9 medium-10'>
                                    <PodsLogsViewer
                                        podName={podState.metadata.name || ''}
                                        group={node.group}
                                        kind={node.kind}
                                        name={node.name}
                                        namespace={podState.metadata.namespace}
                                        applicationName={application.metadata.name}
                                        containerName={AppUtils.getContainerName(podState, selectedNodeInfo.container)}
                                        page={{number: page, untilTimes}}
                                        setPage={pageData => appContext.navigation.goto('.', {page: pageData.number, untilTimes: pageData.untilTimes.join(',')})}
                                    />
                                </div>
                            </div>
                        </div>
                    )
                }
            ]);
        }
        return tabs;
    };

    const getApplicationTabs = () => {
        const tabs: Tab[] = [];
        return tabs;
    };

    return (
        <div style={{width: '100%', height: '100%'}}>
            {selectedNode && (
                <DataLoader
                    noLoaderOnInputChange={true}
                    input={selectedNode.resourceVersion}
                    load={async () => {
                        const managedResources = await services.applications.managedResources(application.metadata.name, {
                            id: {
                                name: selectedNode.name,
                                namespace: selectedNode.namespace,
                                kind: selectedNode.kind,
                                group: selectedNode.group
                            }
                        });
                        const controlled = managedResources.find(item => AppUtils.isSameNode(selectedNode, item));
                        const summary = application.status.resources.find(item => AppUtils.isSameNode(selectedNode, item));
                        const controlledState = (controlled && summary && {summary, state: controlled}) || null;
                        const resQuery = {...selectedNode};
                        if (controlled && controlled.targetState) {
                            resQuery.version = AppUtils.parseApiVersion(controlled.targetState.apiVersion).version;
                        }
                        const liveState = await services.applications.getResource(application.metadata.name, resQuery).catch(() => null);
                        const events =
                            (liveState &&
                                (await services.applications.resourceEvents(application.metadata.name, {
                                    name: liveState.metadata.name,
                                    namespace: liveState.metadata.namespace,
                                    uid: liveState.metadata.uid
                                }))) ||
                            [];
                        let podState: State;
                        if (selectedNode.kind === 'Pod') {
                            podState = liveState;
                        } else {
                            const childPod = AppUtils.findChildPod(selectedNode, tree);
                            if (childPod) {
                                podState = await services.applications.getResource(application.metadata.name, childPod).catch(() => null);
                            }
                        }

                        return {controlledState, liveState, events, podState};
                    }}>
                    {data => (
                        <React.Fragment>
                            <div className='resource-details__header'>
                                <div style={{display: 'flex', flexDirection: 'column', marginRight: '15px', alignItems: 'center', fontSize: '12px'}}>
                                    <ResourceIcon kind={selectedNode.kind} />
                                    {ResourceLabel({kind: selectedNode.kind})}
                                </div>
                                <h1>{selectedNode.name}</h1>
                                {data.controlledState && (
                                    <React.Fragment>
                                        <span style={{marginRight: '5px'}}>
                                            <AppUtils.ComparisonStatusIcon status={data.controlledState.summary.status} resource={data.controlledState.summary} />
                                        </span>
                                    </React.Fragment>
                                )}
                                {(selectedNode as ResourceTreeNode).health && <AppUtils.HealthStatusIcon state={(selectedNode as ResourceTreeNode).health} />}
                                <button
                                    onClick={() => appContext.navigation.goto('.', {deploy: AppUtils.nodeKey(selectedNode)})}
                                    style={{marginLeft: 'auto', marginRight: '5px'}}
                                    className='argo-button argo-button--base'>
                                    <i className='fa fa-sync-alt' /> ??????
                                </button>
                                <button onClick={() => AppUtils.deletePopup(appContext, selectedNode, application)} className='argo-button argo-button--base'>
                                    <i className='fa fa-trash' /> ??????
                                </button>
                            </div>
                            <Tabs
                                navTransparent={true}
                                tabs={getResourceTabs(selectedNode, data.liveState, data.podState, data.events, [
                                    {
                                        title: '??????',
                                        icon: 'fa fa-file-alt',
                                        key: 'summary',
                                        content: <ApplicationNodeInfo application={application} live={data.liveState} controlled={data.controlledState} node={selectedNode} />
                                    }
                                ])}
                                selectedTabKey={props.tab}
                                onTabSelected={selected => appContext.navigation.goto('.', {tab: selected})}
                            />
                        </React.Fragment>
                    )}
                </DataLoader>
            )}
            {isAppSelected && (
                <Tabs navTransparent={true} tabs={getApplicationTabs()} selectedTabKey={tab} onTabSelected={selected => appContext.navigation.goto('.', {tab: selected})} />
            )}
        </div>
    );
};
