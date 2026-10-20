package party.ritmika.tv

import android.content.Context
import android.content.res.ColorStateList
import android.content.res.Resources
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.LayerDrawable
import android.graphics.drawable.StateListDrawable
import androidx.core.content.res.ResourcesCompat

/** Pequeño sistema visual compartido por el shell nativo. */
object NeoBrutalUi {
    val INK = Color.parseColor("#111827")
    val BLACK = Color.parseColor("#0A0A14")
    val PANEL = Color.parseColor("#0F172A")
    val YELLOW = Color.parseColor("#FFE600")
    val CYAN = Color.parseColor("#00E5FF")
    val MAGENTA = Color.parseColor("#F0047F")
    val PINK = Color.parseColor("#EC4899")
    val WHITE = Color.parseColor("#F8FAFC")
    val MUTED = Color.parseColor("#94A3B8")
    val GREEN = Color.parseColor("#22C55E")
    val STROKE = Color.parseColor("#334155")

    fun dp(context: Context, value: Int): Int =
        (value * context.resources.displayMetrics.density).toInt()

    fun paytone(context: Context): Typeface =
        try { ResourcesCompat.getFont(context, R.font.paytone_one) ?: Typeface.DEFAULT_BOLD }
        catch (_: Resources.NotFoundException) { Typeface.DEFAULT_BOLD }

    fun fredoka(context: Context): Typeface =
        try { ResourcesCompat.getFont(context, R.font.fredoka_bold) ?: Typeface.DEFAULT_BOLD }
        catch (_: Resources.NotFoundException) { Typeface.DEFAULT_BOLD }

    fun panel(context: Context, fill: Int, stroke: Int = INK): LayerDrawable {
        val shadow = GradientDrawable().apply { setColor(INK) }
        val face = GradientDrawable().apply {
            setColor(fill)
            setStroke(dp(context, 3), stroke)
            cornerRadius = 0f
        }
        return LayerDrawable(arrayOf(shadow, face)).apply {
            setLayerInset(0, dp(context, 8), dp(context, 8), 0, 0)
            setLayerInset(1, 0, 0, dp(context, 8), dp(context, 8))
        }
    }

    fun buttonBackground(context: Context, primary: Boolean = false, accent: Int? = null): StateListDrawable {
        val fill = when {
            accent != null -> accent
            primary -> YELLOW
            else -> PANEL
        }
        val stroke = if (primary || accent != null) INK else STROKE
        val focusFill = if (primary || accent != null) CYAN else YELLOW
        return StateListDrawable().apply {
            addState(intArrayOf(android.R.attr.state_focused), panel(context, focusFill, INK))
            addState(intArrayOf(android.R.attr.state_pressed), panel(context, WHITE, INK))
            addState(intArrayOf(), panel(context, fill, stroke))
        }
    }

    fun buttonTextColors(primary: Boolean = false, accent: Int? = null): ColorStateList {
        val normal = if (primary || accent != null) INK else WHITE
        return ColorStateList(
            arrayOf(
                intArrayOf(android.R.attr.state_focused),
                intArrayOf(android.R.attr.state_pressed),
                intArrayOf()
            ),
            intArrayOf(INK, INK, normal)
        )
    }

    fun modeRowBackground(context: Context, accent: Int, selected: Boolean): StateListDrawable =
        StateListDrawable().apply {
            if (selected) {
                addState(intArrayOf(android.R.attr.state_focused), panel(context, CYAN, INK))
                addState(intArrayOf(android.R.attr.state_selected), panel(context, accent, INK))
                addState(intArrayOf(), panel(context, accent, INK))
            } else {
                addState(intArrayOf(android.R.attr.state_focused), panel(context, YELLOW, INK))
                addState(intArrayOf(), panel(context, PANEL, STROKE))
            }
        }

    fun modeTextColors(): ColorStateList = ColorStateList(
        arrayOf(
            intArrayOf(android.R.attr.state_selected, android.R.attr.state_focused),
            intArrayOf(android.R.attr.state_selected),
            intArrayOf(android.R.attr.state_focused),
            intArrayOf()
        ),
        intArrayOf(INK, INK, INK, WHITE)
    )

    fun modeSubTextColors(): ColorStateList = ColorStateList(
        arrayOf(
            intArrayOf(android.R.attr.state_selected, android.R.attr.state_focused),
            intArrayOf(android.R.attr.state_selected),
            intArrayOf(android.R.attr.state_focused),
            intArrayOf()
        ),
        intArrayOf(Color.parseColor("#334155"), Color.parseColor("#334155"), Color.parseColor("#334155"), MUTED)
    )
}
