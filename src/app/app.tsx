import {DataLoader, Layout, NavigationManager, Notifications, NotificationsManager, PageContext, Popup, PopupManager, PopupProps} from 'argo-ui';
import {createBrowserHistory} from 'history';
import * as PropTypes from 'prop-types';
import * as React from 'react';
import {Helmet} from 'react-helmet';
import {Redirect, Route, RouteComponentProps, Router, Switch} from 'react-router';
import applications from './applications';
import login from './login';
import {Provider} from './shared/context';
import {services} from './shared/services';
import requests from './shared/services/requests';
import {hashCode} from './shared/utils';

services.viewPreferences.init();
const bases = document.getElementsByTagName('base');
const base = bases.length > 0 ? bases[0].getAttribute('href') || '/' : '/';
export const history = createBrowserHistory({basename: base});
requests.setBaseHRef(base);

const routes: {[path: string]: {component: React.ComponentType<RouteComponentProps<any>>; noLayout?: boolean}} = {
    '/login': {component: login.component as any, noLayout: true},
    '/applications': {component: applications.component, noLayout: true}
};

const navItems = [
    {
        title: 'Manage your applications, and diagnose health problems.',
        path: '/applications',
        iconClassName: 'argo-icon-application'
    }
];

// const versionLoader = services.version.version();

async function isExpiredSSO() {
    try {
        const {iss} = await services.users.get();
        if (iss && iss !== 'argocd') {
            const authSettings = await services.authService.settings();
            return ((authSettings.dexConfig && authSettings.dexConfig.connectors) || []).length > 0 || authSettings.oidcConfig;
        }
    } catch {
        return false;
    }
    return false;
}

requests.onError.subscribe(async err => {
    if (err.status === 401) {
        if (history.location.pathname.startsWith('/login')) {
            return;
        }

        const isSSO = await isExpiredSSO();
        // location might change after async method call, so we need to check again.
        if (history.location.pathname.startsWith('/login')) {
            return;
        }
        // Query for basehref and remove trailing /.
        // If basehref is the default `/` it will become an empty string.
        const basehref = document
            .querySelector('head > base')
            .getAttribute('href')
            .replace(/\/$/, '');
        if (isSSO) {
            window.location.href = `${basehref}/auth/login?return_url=${encodeURIComponent(location.href)}`;
        } else {
            history.push(`/login?return_url=${encodeURIComponent(location.href)}`);
        }
    }
});

export class App extends React.Component<{}, {popupProps: PopupProps; showVersionPanel: boolean; error: Error}> {
    public static childContextTypes = {
        history: PropTypes.object,
        apis: PropTypes.object
    };

    public static getDerivedStateFromError(error: Error) {
        return {error};
    }

    private popupManager: PopupManager;
    private notificationsManager: NotificationsManager;
    private navigationManager: NavigationManager;

    constructor(props: {}) {
        super(props);
        this.state = {popupProps: null, error: null, showVersionPanel: false};
        this.popupManager = new PopupManager();
        this.notificationsManager = new NotificationsManager();
        this.navigationManager = new NavigationManager(history);
    }

    public async componentDidMount() {
        this.popupManager.popupProps.subscribe(popupProps => this.setState({popupProps}));
        const authSettings = await services.authService.settings();
        const {trackingID, anonymizeUsers} = authSettings.googleAnalytics || {trackingID: '', anonymizeUsers: true};
        const {loggedIn, username} = await services.users.get();
        if (trackingID) {
            const ga = await import('react-ga');
            ga.initialize(trackingID);
            const trackPageView = () => {
                if (loggedIn && username) {
                    const userId = !anonymizeUsers ? username : hashCode(username).toString();
                    ga.set({userId});
                }
                ga.pageview(location.pathname + location.search);
            };
            trackPageView();
            history.listen(trackPageView);
        }
        if (authSettings.uiCssURL) {
            const link = document.createElement('link');
            link.href = authSettings.uiCssURL;
            link.rel = 'stylesheet';
            link.type = 'text/css';
            document.head.appendChild(link);
        }
    }

    public render() {
        if (this.state.error != null) {
            const stack = this.state.error.stack;
            return (
                <React.Fragment>
                    <p>Something went wrong!</p>
                    <p>?????????.</p>
                    <br />
                    <p>Stacktrace:</p>
                    <pre>{stack}</pre>
                </React.Fragment>
            );
        }

        return (
            <React.Fragment>
                <Helmet>
                    <link rel='icon' type='image/png' href={`${base}assets/favicon/favicon-32x32.png`} sizes='32x32' />
                    <link rel='icon' type='image/png' href={`${base}assets/favicon/favicon-16x16.png`} sizes='16x16' />
                </Helmet>
                <PageContext.Provider value={{title: 'Argo CD'}}>
                    <Provider value={{history, popup: this.popupManager, notifications: this.notificationsManager, navigation: this.navigationManager, baseHref: base}}>
                        {this.state.popupProps && <Popup {...this.state.popupProps} />}
                        <Router history={history}>
                            <Switch>
                                <Redirect exact={true} path='/' to='/applications' />
                                {Object.keys(routes).map(path => {
                                    const route = routes[path];
                                    return (
                                        <Route
                                            key={path}
                                            path={path}
                                            render={routeProps =>
                                                route.noLayout ? (
                                                    <div>
                                                        <route.component {...routeProps} />
                                                    </div>
                                                ) : (
                                                    <Layout navItems={navItems}></Layout>
                                                )
                                            }
                                        />
                                    );
                                })}
                                <Redirect path='*' to='/' />
                            </Switch>
                        </Router>
                        <DataLoader load={() => services.authService.settings()}>
                            {s =>
                                (s.help && s.help.chatUrl && (
                                    <div style={{position: 'fixed', right: 10, bottom: 10}}>
                                        <a href={s.help.chatUrl} className='argo-button argo-button--special'>
                                            <i className='fas fa-comment-alt' /> {s.help.chatText}
                                        </a>
                                    </div>
                                )) ||
                                null
                            }
                        </DataLoader>
                    </Provider>
                </PageContext.Provider>
                <Notifications notifications={this.notificationsManager.notifications} />
                {/*<VersionPanel version={versionLoader} isShown={this.state.showVersionPanel} onClose={() => this.setState({showVersionPanel: false})} />*/}
            </React.Fragment>
        );
    }

    public getChildContext() {
        return {history, apis: {popup: this.popupManager, notifications: this.notificationsManager, navigation: this.navigationManager}};
    }
}
