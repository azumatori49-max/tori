package com.example.agekiosk.ui

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.RectF
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Cameraswitch
import androidx.compose.material.icons.filled.QuestionMark
import androidx.compose.material.icons.filled.Warning
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.agekiosk.R
import com.example.agekiosk.camera.CameraController
import com.example.agekiosk.model.KioskState
import com.example.agekiosk.model.KioskViewModel

@Composable
fun KioskScreen(vm: KioskViewModel = viewModel()) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    var hasPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED
        )
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { hasPermission = it }

    LaunchedEffect(Unit) {
        if (!hasPermission) permissionLauncher.launch(Manifest.permission.CAMERA)
    }

    val state by vm.state.collectAsState()
    val faceBox by vm.faceBox.collectAsState()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .pointerInput(Unit) {
                detectTapGestures(onLongPress = { vm.resetToWaiting() })
            }
    ) {
        if (hasPermission) {
            CameraPreview(onController = { previewView ->
                val controller = CameraController(context) { vm.onFrame(it) }
                controller.bind(lifecycleOwner, previewView)
            })
            FaceBoxOverlay(box = faceBox)
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            Header()
            Box(modifier = Modifier.fillMaxWidth()) {
                if (!hasPermission) {
                    StateCard {
                        MessageRow(
                            title = stringRes(R.string.permission_title),
                            sub = stringRes(R.string.permission_sub),
                            icon = Icons.Filled.Warning,
                        )
                    }
                } else {
                    when (val s = state) {
                        is KioskState.Waiting -> StateCard {
                            MessageRow(
                                title = stringRes(R.string.waiting_title),
                                sub = stringRes(R.string.waiting_sub),
                                icon = Icons.Filled.AccountCircle,
                            )
                        }
                        is KioskState.Scanning -> StateCard { ScanningRow(s.progress) }
                        is KioskState.Result -> StateCard { ResultRow(s.age) }
                        is KioskState.NoModel -> StateCard {
                            MessageRow(
                                title = stringRes(R.string.model_missing_title),
                                sub = stringRes(R.string.model_missing_sub),
                                icon = Icons.Filled.QuestionMark,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun stringRes(id: Int): String = androidx.compose.ui.res.stringResource(id)

@Composable
private fun Header() {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                stringRes(R.string.title),
                color = Color.White,
                fontSize = 22.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                stringRes(R.string.subtitle),
                color = Color.White.copy(alpha = 0.7f),
                fontSize = 14.sp,
            )
        }
        Icon(Icons.Filled.Cameraswitch, contentDescription = null, tint = Color.White.copy(alpha = 0.55f))
    }
}

@Composable
private fun StateCard(content: @Composable () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(28.dp))
            .background(Color.White.copy(alpha = 0.08f))
            .padding(24.dp)
    ) { content() }
}

@Composable
private fun MessageRow(title: String, sub: String, icon: androidx.compose.ui.graphics.vector.ImageVector) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(36.dp))
        Spacer(Modifier.size(16.dp))
        Column {
            Text(title, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
            Text(sub, color = Color.White.copy(alpha = 0.7f), fontSize = 14.sp)
        }
    }
}

@Composable
private fun ScanningRow(progress: Float) {
    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            CircularProgressIndicator(color = Color.White, strokeWidth = 3.dp, modifier = Modifier.size(20.dp))
            Spacer(Modifier.size(12.dp))
            Text(stringRes(R.string.scanning), color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
        }
        Spacer(Modifier.size(12.dp))
        LinearProgressIndicator(progress = { progress }, color = Color.White, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun ResultRow(age: Int) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(stringRes(R.string.result_label), color = Color.White.copy(alpha = 0.7f), fontSize = 14.sp)
        Row(verticalAlignment = Alignment.Bottom) {
            Text("$age", color = Color.White, fontSize = 96.sp, fontWeight = FontWeight.Bold)
            Text(stringRes(R.string.result_unit), color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.SemiBold)
        }
        Text(
            stringRes(R.string.footer_note),
            color = Color.White.copy(alpha = 0.55f),
            fontSize = 12.sp,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun CameraPreview(onController: (PreviewView) -> Unit) {
    AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { ctx ->
            PreviewView(ctx).also { pv ->
                pv.scaleType = PreviewView.ScaleType.FILL_CENTER
                onController(pv)
            }
        }
    )
}

@Composable
private fun FaceBoxOverlay(box: RectF?) {
    Canvas(modifier = Modifier.fillMaxSize()) {
        val b = box ?: return@Canvas
        val left = b.left * size.width
        val top = b.top * size.height
        val w = b.width() * size.width
        val h = b.height() * size.height
        drawRoundRect(
            color = Color.White.copy(alpha = 0.85f),
            topLeft = Offset(left, top),
            size = Size(w, h),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(24f, 24f),
            style = Stroke(width = 4f),
        )
    }
}
