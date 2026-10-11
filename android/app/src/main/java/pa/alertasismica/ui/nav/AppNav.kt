package pa.alertasismica.ui.nav

import androidx.compose.foundation.layout.padding
import androidx.compose.ui.Modifier
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import pa.alertasismica.ui.drill.DrillScreen
import pa.alertasismica.ui.detail.EventDetailScreen
import pa.alertasismica.ui.guide.GuideScreen
import pa.alertasismica.ui.health.HealthScreen
import pa.alertasismica.ui.home.HomeScreen
import pa.alertasismica.ui.onboarding.OnboardingScreen
import pa.alertasismica.ui.settings.SettingsScreen
import pa.alertasismica.ui.web.WebScreen

private const val ROUTE_HOME = "home"
private const val ROUTE_WEB = "web"
private const val ROUTE_GUIDE = "guide"
private const val ROUTE_DRILL = "drill"
private const val ROUTE_SETTINGS = "settings"
private const val ROUTE_HEALTH = "health"
private const val ROUTE_ONBOARDING = "onboarding"
private const val ROUTE_DETAIL = "detail/{eventId}"

private data class Tab(val route: String, val label: String, val icon: ImageVector)

private val tabs = listOf(
    Tab(ROUTE_WEB, "Mapa", Icons.Filled.Place),
    Tab(ROUTE_HOME, "Inicio", Icons.Filled.Home),
    Tab(ROUTE_GUIDE, "Guía", Icons.Filled.Info),
    Tab(ROUTE_DRILL, "Simulacro", Icons.Filled.Notifications),
    Tab(ROUTE_SETTINGS, "Ajustes", Icons.Filled.Settings),
)

@Composable
fun AppNav(startOnboarding: Boolean) {
    val nav = rememberNavController()
    val backStack by nav.currentBackStackEntryAsState()
    val current = backStack?.destination?.route
    val showBars = current != ROUTE_ONBOARDING && current != ROUTE_DETAIL && current != ROUTE_HEALTH

    Scaffold(
        bottomBar = {
            if (showBars) {
                NavigationBar {
                    tabs.forEach { tab ->
                        NavigationBarItem(
                            selected = current == tab.route,
                            onClick = {
                                nav.navigate(tab.route) {
                                    popUpTo(ROUTE_WEB) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(tab.icon, contentDescription = tab.label) },
                            label = { Text(tab.label) },
                        )
                    }
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = nav,
            startDestination = if (startOnboarding) ROUTE_ONBOARDING else ROUTE_WEB,
            modifier = Modifier.padding(padding),
        ) {
            composable(ROUTE_ONBOARDING) {
                OnboardingScreen(onDone = {
                    nav.navigate(ROUTE_WEB) { popUpTo(ROUTE_ONBOARDING) { inclusive = true } }
                })
            }
            composable(ROUTE_WEB) { WebScreen() }
            composable(ROUTE_HOME) {
                HomeScreen(
                    onEventClick = { nav.navigate("detail/$it") },
                    onHealthClick = { nav.navigate(ROUTE_HEALTH) },
                )
            }
            composable(
                ROUTE_DETAIL,
                arguments = listOf(navArgument("eventId") { type = NavType.StringType }),
            ) { entry ->
                EventDetailScreen(
                    eventId = entry.arguments?.getString("eventId").orEmpty(),
                    onBack = { nav.popBackStack() },
                )
            }
            composable(ROUTE_GUIDE) { GuideScreen() }
            composable(ROUTE_DRILL) { DrillScreen() }
            composable(ROUTE_SETTINGS) {
                SettingsScreen(onHealthClick = { nav.navigate(ROUTE_HEALTH) })
            }
            composable(ROUTE_HEALTH) { HealthScreen(onBack = { nav.popBackStack() }) }
        }
    }
}
